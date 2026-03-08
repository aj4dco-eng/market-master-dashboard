import { useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, FileSpreadsheet, Package, Truck, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";

/* ─────────── Types ─────────── */
interface ProductRow {
  name: string;
  category: string;
  qty: number;
  price: number;
  barcode?: string;
  status: "new" | "existing";
  valid: boolean;
  selected: boolean;
}

interface OrderRow {
  supplier: string;
  product: string;
  qty: number;
  unitPrice: number;
  date: string;
  valid: boolean;
  selected: boolean;
}

interface GroupedOrder {
  supplier: string;
  date: string;
  items: OrderRow[];
  selected: boolean;
}

/* ─────────── Helpers ─────────── */
const colMap: Record<string, string> = {
  "الصنف": "name", name: "name",
  "الفئة": "category", category: "category",
  "الكمية": "qty", qty: "qty",
  "السعر": "price", price: "price",
  "الباركود": "barcode", barcode: "barcode",
};

const orderColMap: Record<string, string> = {
  "اسم المورد": "supplier", supplier: "supplier",
  "الصنف": "product", product: "product",
  "الكمية": "qty", qty: "qty",
  "سعر الشراء": "unitPrice", unit_price: "unitPrice",
  "التاريخ": "date", date: "date",
};

function mapRow(raw: Record<string, any>, mapping: Record<string, string>) {
  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(raw)) {
    const k = key.trim().toLowerCase();
    for (const [src, dst] of Object.entries(mapping)) {
      if (src.toLowerCase() === k) {
        out[dst] = val;
        break;
      }
    }
  }
  return out;
}

function downloadTemplate(name: string, headers: string[][]) {
  const ws = XLSX.utils.aoa_to_sheet(headers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, name);
}

function exportToExcel(data: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

/* ─────────── Drop Zone ─────────── */
function DropZone({ onFile, accept, label }: { onFile: (f: File) => void; accept: string; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">xlsx, xls, csv</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/*                 MAIN PAGE                  */
/* ═══════════════════════════════════════════ */
export default function ImportPage() {
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">استيراد وتصدير البيانات</h1>
        </div>

        <Tabs defaultValue="products" dir="rtl">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="products" className="gap-2">
              <Package className="h-4 w-4" /> استيراد المنتجات
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Truck className="h-4 w-4" /> استيراد طلبيات الشراء
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" /> تصدير البيانات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products"><ProductsImportTab toast={toast} /></TabsContent>
          <TabsContent value="orders"><OrdersImportTab toast={toast} /></TabsContent>
          <TabsContent value="export"><ExportTab toast={toast} /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

/* ═══════════════════════════════════════════ */
/*           TAB 1: PRODUCTS IMPORT           */
/* ═══════════════════════════════════════════ */
function ProductsImportTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

      // Fetch existing products
      const { data: existing } = await (supabase.from("products" as any)).select("id, name");
      const existingNames = new Set((existing || []).map((p: any) => p.name?.trim().toLowerCase()));

      const parsed: ProductRow[] = raw.map((r) => {
        const m = mapRow(r, colMap);
        const name = String(m.name || "").trim();
        const valid = !!name && m.price != null && !isNaN(Number(m.price));
        return {
          name,
          category: String(m.category || "عام").trim(),
          qty: Number(m.qty) || 0,
          price: Number(m.price) || 0,
          barcode: m.barcode ? String(m.barcode).trim() : undefined,
          status: existingNames.has(name.toLowerCase()) ? "existing" : "new",
          valid,
          selected: valid,
        };
      });
      setRows(parsed);
    } catch {
      toast({ title: "خطأ في قراءة الملف", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }, [toast]);

  const toggleAll = (checked: boolean) => setRows((prev) => prev.map((r) => ({ ...r, selected: r.valid ? checked : false })));
  const toggle = (i: number) => setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const selected = rows.filter((r) => r.selected);
  const newCount = rows.filter((r) => r.status === "new").length;
  const existCount = rows.filter((r) => r.status === "existing").length;

  const handleImport = async () => {
    if (!selected.length) return;
    setImporting(true);
    setProgress(0);
    let imported = 0;
    let updated = 0;

    const { data: existingProducts } = await (supabase.from("products" as any)).select("id, name");

    for (let i = 0; i < selected.length; i++) {
      const row = selected[i];
      try {
        // Find or create category
        const { data: cat } = await (supabase.from("categories" as any))
          .select("id").eq("name", row.category).single();
        let catId = cat?.id;
        if (!catId) {
          const { data: newCat } = await (supabase.from("categories" as any))
            .insert({ name: row.category }).select().single();
          catId = newCat?.id;
        }

        const existing = (existingProducts || []).find(
          (p: any) => p.name?.trim().toLowerCase() === row.name.toLowerCase()
        );

        if (existing) {
          await (supabase.from("products" as any)).update({
            current_stock: row.qty,
            selling_price: row.price,
            category_id: catId,
          }).eq("id", existing.id);
          updated++;
        } else {
          await (supabase.from("products" as any)).insert({
            name: row.name,
            category_id: catId,
            current_stock: row.qty,
            selling_price: row.price,
            barcode: row.barcode || null,
            purchase_price: +(row.price * 0.8).toFixed(2),
            min_stock_alert: 5,
            unit: "قطعة",
          });
          imported++;
        }
      } catch { /* skip */ }
      setProgress(Math.round(((i + 1) / selected.length) * 100));
    }

    toast({ title: `تم استيراد ${imported} منتج بنجاح، ${updated} تم تحديثه` });
    setRows([]);
    setImporting(false);
  };

  return (
    <Card className="p-6 space-y-5 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">استيراد المنتجات من ملف إكسل</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadTemplate("قالب_المنتجات.xlsx", [
              ["الصنف", "الفئة", "الكمية", "السعر", "الباركود"],
              ["مثال: حليب", "ألبان", 100, 5.5, "123456"],
            ])
          }
        >
          <Download className="h-4 w-4 ml-1" /> تحميل قالب إكسل
        </Button>
      </div>

      {rows.length === 0 && !parsing && (
        <DropZone
          onFile={parseFile}
          accept=".xlsx,.xls,.csv"
          label="اسحب ملف الإكسل هنا أو اضغط للاختيار"
        />
      )}

      {parsing && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {rows.length > 0 && !parsing && (
        <>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span>تم اكتشاف <strong>{rows.length}</strong> صنف</span>
            <Badge variant="default" className="bg-green-600">{newCount} جديد</Badge>
            <Badge variant="secondary" className="bg-orange-500 text-white">{existCount} موجود</Badge>
          </div>

          <ScrollArea className="max-h-[400px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.length === rows.filter((r) => r.valid).length && selected.length > 0}
                      onCheckedChange={(c) => toggleAll(!!c)}
                    />
                  </TableHead>
                  <TableHead>الصنف</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={!r.valid ? "bg-destructive/10" : ""}>
                    <TableCell>
                      <Checkbox disabled={!r.valid} checked={r.selected} onCheckedChange={() => toggle(i)} />
                    </TableCell>
                    <TableCell className="font-medium">{r.name || <span className="text-destructive">مفقود</span>}</TableCell>
                    <TableCell>{r.category}</TableCell>
                    <TableCell>{r.qty}</TableCell>
                    <TableCell>{r.price}</TableCell>
                    <TableCell>
                      {!r.valid ? (
                        <Badge variant="destructive"><AlertCircle className="h-3 w-3 ml-1" />بيانات ناقصة</Badge>
                      ) : r.status === "new" ? (
                        <Badge className="bg-green-600">جديد</Badge>
                      ) : (
                        <Badge className="bg-orange-500 text-white">موجود</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {importing && <Progress value={progress} className="h-3" />}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleImport} disabled={importing || !selected.length}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
              استيراد المحدد ({selected.length})
            </Button>
            <Button variant="outline" onClick={() => setRows([])} disabled={importing}>
              إلغاء
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════ */
/*        TAB 2: PURCHASE ORDERS IMPORT       */
/* ═══════════════════════════════════════════ */
function OrdersImportTab({ toast }: { toast: any }) {
  const [groups, setGroups] = useState<GroupedOrder[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

      const rows: OrderRow[] = raw.map((r) => {
        const m = mapRow(r, orderColMap);
        const valid = !!m.supplier && !!m.product && m.qty > 0;
        return {
          supplier: String(m.supplier || "").trim(),
          product: String(m.product || "").trim(),
          qty: Number(m.qty) || 0,
          unitPrice: Number(m.unitPrice) || 0,
          date: m.date ? String(m.date).trim() : new Date().toISOString().split("T")[0],
          valid,
          selected: valid,
        };
      });

      // Group by supplier + date
      const map = new Map<string, GroupedOrder>();
      rows.forEach((r) => {
        const key = `${r.supplier}|${r.date}`;
        if (!map.has(key)) map.set(key, { supplier: r.supplier, date: r.date, items: [], selected: true });
        map.get(key)!.items.push(r);
      });
      setGroups(Array.from(map.values()));
    } catch {
      toast({ title: "خطأ في قراءة الملف", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }, [toast]);

  const toggleGroup = (i: number) => setGroups((prev) => prev.map((g, idx) => idx === i ? { ...g, selected: !g.selected } : g));

  const handleImport = async () => {
    const sel = groups.filter((g) => g.selected);
    if (!sel.length) return;
    setImporting(true);
    setProgress(0);

    const { data: suppliers } = await (supabase.from("suppliers" as any)).select("id, name");
    const { data: products } = await (supabase.from("products" as any)).select("id, name");
    let created = 0;

    for (let gi = 0; gi < sel.length; gi++) {
      const g = sel[gi];
      const sup = (suppliers || []).find((s: any) => s.name?.trim().toLowerCase() === g.supplier.toLowerCase());
      if (!sup) {
        toast({ title: `المورد "${g.supplier}" غير موجود`, variant: "destructive" });
        continue;
      }

      // Generate order number
      const { data: orderNum } = await supabase.rpc("generate_order_number");
      const totalAmount = g.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);

      const { data: order } = await (supabase.from("purchase_orders" as any)).insert({
        order_number: orderNum,
        supplier_id: sup.id,
        order_date: g.date,
        status: "received",
        total_amount: totalAmount,
      }).select().single();

      if (!order) continue;

      for (const item of g.items) {
        const prod = (products || []).find((p: any) => p.name?.trim().toLowerCase() === item.product.toLowerCase());
        await (supabase.from("purchase_order_items" as any)).insert({
          order_id: order.id,
          product_id: prod?.id || null,
          product_name: item.product,
          requested_qty: item.qty,
          received_qty: item.qty,
          actual_purchase_price: item.unitPrice,
          requested_purchase_price: item.unitPrice,
        });

        // Update product stock
        if (prod) {
          const { data: current } = await (supabase.from("products" as any)).select("current_stock").eq("id", prod.id).single();
          await (supabase.from("products" as any)).update({
            current_stock: (current?.current_stock || 0) + item.qty,
          }).eq("id", prod.id);
        }
      }
      created++;
      setProgress(Math.round(((gi + 1) / sel.length) * 100));
    }

    toast({ title: `تم إنشاء ${created} طلبية شراء بنجاح` });
    setGroups([]);
    setImporting(false);
  };

  return (
    <Card className="p-6 space-y-5 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">استيراد طلبيات الشراء من إكسل</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadTemplate("قالب_الطلبيات.xlsx", [
              ["اسم المورد", "الصنف", "الكمية", "سعر الشراء", "التاريخ"],
              ["مورد 1", "حليب", 50, 4, "2026-03-01"],
            ])
          }
        >
          <Download className="h-4 w-4 ml-1" /> تحميل قالب إكسل
        </Button>
      </div>

      {groups.length === 0 && !parsing && (
        <DropZone onFile={parseFile} accept=".xlsx,.xls,.csv" label="اسحب ملف طلبيات الشراء هنا أو اضغط للاختيار" />
      )}

      {parsing && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}

      {groups.length > 0 && !parsing && (
        <>
          <p className="text-sm text-muted-foreground">تم اكتشاف <strong>{groups.length}</strong> طلبية — <strong>{groups.reduce((s, g) => s + g.items.length, 0)}</strong> صنف</p>

          <ScrollArea className="max-h-[400px] border rounded-lg">
            <div className="space-y-4 p-4">
              {groups.map((g, gi) => (
                <Card key={gi} className={`p-4 space-y-3 ${!g.selected ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={g.selected} onCheckedChange={() => toggleGroup(gi)} />
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{g.supplier}</span>
                    <Badge variant="outline">{g.date}</Badge>
                    <Badge variant="secondary">{g.items.length} صنف</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الصنف</TableHead>
                        <TableHead>الكمية</TableHead>
                        <TableHead>سعر الشراء</TableHead>
                        <TableHead>الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.items.map((it, ii) => (
                        <TableRow key={ii} className={!it.valid ? "bg-destructive/10" : ""}>
                          <TableCell>{it.product}</TableCell>
                          <TableCell>{it.qty}</TableCell>
                          <TableCell>{it.unitPrice}</TableCell>
                          <TableCell>{(it.qty * it.unitPrice).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {importing && <Progress value={progress} className="h-3" />}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleImport} disabled={importing || !groups.some((g) => g.selected)}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
              استيراد الطلبيات ({groups.filter((g) => g.selected).length})
            </Button>
            <Button variant="outline" onClick={() => setGroups([])} disabled={importing}>إلغاء</Button>
          </div>
        </>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════ */
/*            TAB 3: DATA EXPORT              */
/* ═══════════════════════════════════════════ */
function ExportTab({ toast }: { toast: any }) {
  const [loading, setLoading] = useState<string | null>(null);

  const exportProducts = async () => {
    setLoading("products");
    const { data } = await (supabase.from("products" as any)).select("name, barcode, current_stock, selling_price, purchase_price, unit, is_active");
    if (data?.length) {
      exportToExcel(
        data.map((p: any) => ({
          "الصنف": p.name,
          "الباركود": p.barcode || "",
          "المخزون": p.current_stock,
          "سعر البيع": p.selling_price,
          "سعر الشراء": p.purchase_price,
          "الوحدة": p.unit,
          "نشط": p.is_active ? "نعم" : "لا",
        })),
        `المنتجات_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast({ title: `تم تصدير ${data.length} منتج` });
    } else {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
    }
    setLoading(null);
  };

  const exportLowStock = async () => {
    setLoading("low");
    const { data } = await (supabase.from("products" as any))
      .select("name, barcode, current_stock, min_stock_alert, selling_price, unit");
    const low = (data || []).filter((p: any) => (p.current_stock ?? 0) <= (p.min_stock_alert ?? 0));
    if (low.length) {
      exportToExcel(
        low.map((p: any) => ({
          "الصنف": p.name,
          "الباركود": p.barcode || "",
          "المخزون الحالي": p.current_stock,
          "الحد الأدنى": p.min_stock_alert,
          "سعر البيع": p.selling_price,
        })),
        `مخزون_منخفض_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast({ title: `تم تصدير ${low.length} منتج بمخزون منخفض` });
    } else {
      toast({ title: "لا توجد منتجات بمخزون منخفض" });
    }
    setLoading(null);
  };

  const exportOrders = async () => {
    setLoading("orders");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: orders } = await (supabase.from("purchase_orders" as any))
      .select("order_number, order_date, status, total_amount, suppliers(name)")
      .gte("order_date", thirtyDaysAgo.toISOString().split("T")[0]);

    if (orders?.length) {
      exportToExcel(
        orders.map((o: any) => ({
          "رقم الطلبية": o.order_number,
          "المورد": o.suppliers?.name || "",
          "التاريخ": o.order_date,
          "الحالة": o.status,
          "المبلغ الإجمالي": o.total_amount,
        })),
        `طلبيات_آخر_30_يوم_${new Date().toISOString().split("T")[0]}.xlsx`
      );
      toast({ title: `تم تصدير ${orders.length} طلبية` });
    } else {
      toast({ title: "لا توجد طلبيات في آخر 30 يوم", variant: "destructive" });
    }
    setLoading(null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3 mt-4">
      {[
        { key: "products", title: "تصدير المنتجات", desc: "جميع المنتجات مع المخزون والأسعار", icon: Package, fn: exportProducts },
        { key: "low", title: "تصدير المخزون المنخفض", desc: "المنتجات التي وصلت للحد الأدنى", icon: AlertCircle, fn: exportLowStock },
        { key: "orders", title: "تصدير طلبيات آخر 30 يوم", desc: "جميع طلبيات الشراء الأخيرة", icon: Truck, fn: exportOrders },
      ].map((item) => (
        <Card key={item.key} className="p-6 flex flex-col items-center text-center gap-4">
          <item.icon className="h-10 w-10 text-primary" />
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.desc}</p>
          <Button onClick={item.fn} disabled={loading === item.key} className="w-full">
            {loading === item.key ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Download className="h-4 w-4 ml-1" />}
            تصدير
          </Button>
        </Card>
      ))}
    </div>
  );
}
