import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Package, Warehouse, TrendingUp, Star, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function presetRange(preset: string): { start: string; end: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];
  if (preset === "month") return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(now) };
  if (preset === "last_month") return { start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  if (preset === "quarter") return { start: iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)), end: iso(now) };
  if (preset === "year") return { start: iso(new Date(now.getFullYear(), 0, 1)), end: iso(now) };
  if (preset === "last_year") return { start: iso(new Date(now.getFullYear() - 1, 0, 1)), end: iso(new Date(now.getFullYear() - 1, 11, 31)) };
  return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(now) };
}

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <Tabs defaultValue="inventory" dir="rtl">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inventory">تقرير المخزون</TabsTrigger>
            <TabsTrigger value="purchases">تقرير المشتريات</TabsTrigger>
            <TabsTrigger value="suppliers">تقرير الموردين</TabsTrigger>
            <TabsTrigger value="financial">التقرير المالي</TabsTrigger>
          </TabsList>
          <TabsContent value="inventory"><InventoryReport /></TabsContent>
          <TabsContent value="purchases"><PurchasesReport /></TabsContent>
          <TabsContent value="suppliers"><SuppliersReport /></TabsContent>
          <TabsContent value="financial"><FinancialReport /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function InventoryReport() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: products, isLoading } = useQuery({
    queryKey: ["report-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories(name)").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["report-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    if (categoryFilter === "all") return products;
    return products.filter(p => p.category_id === categoryFilter);
  }, [products, categoryFilter]);

  const totalProducts = filtered.length;
  const stockByCost = filtered.reduce((s, p) => s + (p.current_stock ?? 0) * (p.purchase_price ?? 0), 0);
  const stockBySell = filtered.reduce((s, p) => s + (p.current_stock ?? 0) * (p.selling_price ?? 0), 0);
  const expectedProfit = stockBySell - stockByCost;

  const exportCSV = () => {
    const headers = ["الاسم", "الصنف", "الكمية", "سعر الشراء", "سعر البيع", "قيمة المخزون", "الربح المتوقع"];
    const rows = filtered.map(p => [
      p.name,
      (p.categories as any)?.name ?? "",
      p.current_stock ?? 0,
      p.purchase_price ?? 0,
      p.selling_price ?? 0,
      (p.current_stock ?? 0) * (p.purchase_price ?? 0),
      (p.current_stock ?? 0) * ((p.selling_price ?? 0) - (p.purchase_price ?? 0)),
    ]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-report.csv";
    a.click();
  };

  const stats = [
    { title: "إجمالي المنتجات النشطة", value: totalProducts.toLocaleString("en-US"), icon: Package },
    { title: "قيمة المخزون بسعر الشراء", value: formatCurrency(stockByCost), icon: Warehouse },
    { title: "قيمة المخزون بسعر البيع", value: formatCurrency(stockBySell), icon: TrendingUp },
    { title: "الربح المتوقع", value: formatCurrency(expectedProfit), icon: TrendingUp },
  ];

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.title}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl font-bold" dir="ltr">{s.value}</div>}</CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="كل الأصناف" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأصناف</SelectItem>
            {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportCSV}><Download className="ml-2 h-4 w-4" />تصدير CSV</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الصنف</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>سعر الشراء</TableHead>
                <TableHead>سعر البيع</TableHead>
                <TableHead>قيمة المخزون</TableHead>
                <TableHead>الربح المتوقع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{(p.categories as any)?.name ?? "-"}</TableCell>
                  <TableCell dir="ltr">{(p.current_stock ?? 0).toLocaleString("en-US")}</TableCell>
                  <TableCell dir="ltr">{formatCurrency(p.purchase_price ?? 0)}</TableCell>
                  <TableCell dir="ltr">{formatCurrency(p.selling_price ?? 0)}</TableCell>
                  <TableCell dir="ltr">{formatCurrency((p.current_stock ?? 0) * (p.purchase_price ?? 0))}</TableCell>
                  <TableCell dir="ltr">{formatCurrency((p.current_stock ?? 0) * ((p.selling_price ?? 0) - (p.purchase_price ?? 0)))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PurchasesReport() {
  const [preset, setPreset] = useState<string>("year");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const dateRange = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) return { start: customStart, end: customEnd };
    return presetRange(preset);
  }, [preset, customStart, customEnd]);

  const { data: suppliersList } = useQuery({
    queryKey: ["report-suppliers-list"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, company_name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["report-purchases", dateRange, supplierFilter],
    queryFn: async () => {
      let q = supabase.from("purchase_orders").select("*, suppliers(name, company_name)").gte("order_date", dateRange.start).lte("order_date", dateRange.end).order("order_date", { ascending: false });
      if (supplierFilter !== "all") q = q.eq("supplier_id", supplierFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  const receivedOrders = useMemo(() => (orders ?? []).filter(o => o.status === "received" || o.status === "partial"), [orders]);

  const totalOrders = orders?.length ?? 0;
  const totalAmount = receivedOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const avgAmount = receivedOrders.length > 0 ? totalAmount / receivedOrders.length : 0;
  const activeSuppliersCount = new Set(receivedOrders.map(o => o.supplier_id)).size;

  const monthlyChart = useMemo(() => {
    const grouped: Record<string, { key: string; label: string; total: number; count: number }> = {};
    receivedOrders.forEach(o => {
      if (!o.order_date) return;
      const d = new Date(o.order_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!grouped[key]) grouped[key] = { key, label, total: 0, count: 0 };
      grouped[key].total += (o.total_amount ?? 0);
      grouped[key].count++;
    });
    return Object.values(grouped).sort((a, b) => a.key.localeCompare(b.key));
  }, [receivedOrders]);

  const bySupplier = useMemo(() => {
    const grouped: Record<string, { name: string; count: number; total: number; lastOrder: string }> = {};
    receivedOrders.forEach(o => {
      const name = (o.suppliers as any)?.company_name || (o.suppliers as any)?.name || "غير محدد";
      if (!grouped[o.supplier_id]) grouped[o.supplier_id] = { name, count: 0, total: 0, lastOrder: "" };
      grouped[o.supplier_id].count++;
      grouped[o.supplier_id].total += (o.total_amount ?? 0);
      if (o.order_date && o.order_date > grouped[o.supplier_id].lastOrder) grouped[o.supplier_id].lastOrder = o.order_date;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [receivedOrders]);

  const statusLabel: Record<string, string> = { pending: "معلقة", awaiting_approval: "بانتظار الموافقة", approved: "تمت الموافقة", received: "مستلمة", partial: "جزئية", cancelled: "ملغاة" };

  const exportMonthlyCSV = () => {
    const headers = ["الشهر", "عدد الطلبيات", "إجمالي المشتريات"];
    const rows = monthlyChart.map(m => [m.label, m.count, m.total.toFixed(2)]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `purchases-monthly-${dateRange.start}_${dateRange.end}.csv`; a.click();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">هذا الشهر</SelectItem>
            <SelectItem value="last_month">الشهر الماضي</SelectItem>
            <SelectItem value="quarter">آخر 3 أشهر</SelectItem>
            <SelectItem value="year">هذا العام</SelectItem>
            <SelectItem value="last_year">العام الماضي</SelectItem>
            <SelectItem value="custom">فترة مخصصة</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <>
            <Input type="date" dir="ltr" className="w-40" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-muted-foreground">إلى</span>
            <Input type="date" dir="ltr" className="w-40" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </>
        )}
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="كل الموردين" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الموردين</SelectItem>
            {suppliersList?.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name || s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportMonthlyCSV}><Download className="ml-2 h-4 w-4" />تصدير شهري</Button>
        <span className="text-xs text-muted-foreground mr-auto" dir="ltr">{dateRange.start} → {dateRange.end}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "إجمالي الطلبيات (كل الحالات)", value: totalOrders.toLocaleString("en-US") },
          { title: "المشتريات (مستلمة/جزئية)", value: formatCurrency(totalAmount) },
          { title: "متوسط قيمة الطلبية", value: formatCurrency(avgAmount) },
          { title: "عدد الموردين النشطين", value: activeSuppliersCount.toLocaleString("en-US") },
        ].map(s => (
          <Card key={s.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.title}</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl font-bold" dir="ltr">{s.value}</div>}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">المشتريات الشهرية</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[280px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" name="المشتريات" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ملخص المشتريات الشهرية</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشهر</TableHead>
                <TableHead>عدد الطلبيات</TableHead>
                <TableHead>إجمالي المشتريات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyChart.map(m => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell dir="ltr">{m.count.toLocaleString("en-US")}</TableCell>
                  <TableCell dir="ltr" className="font-semibold">{formatCurrency(m.total)}</TableCell>
                </TableRow>
              ))}
              {monthlyChart.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">المشتريات حسب المورد خلال الفترة</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المورد</TableHead>
                <TableHead>عدد الطلبيات</TableHead>
                <TableHead>إجمالي المشتريات</TableHead>
                <TableHead>آخر طلبية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySupplier.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell dir="ltr">{s.count.toLocaleString("en-US")}</TableCell>
                  <TableCell dir="ltr" className="font-semibold">{formatCurrency(s.total)}</TableCell>
                  <TableCell dir="ltr">{s.lastOrder ? new Date(s.lastOrder).toLocaleDateString("en-US") : "-"}</TableCell>
                </TableRow>
              ))}
              {bySupplier.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">تفاصيل الطلبيات</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلبية</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map(o => (
                <TableRow key={o.id}>
                  <TableCell dir="ltr" className="font-mono">{o.order_number}</TableCell>
                  <TableCell>{(o.suppliers as any)?.company_name || (o.suppliers as any)?.name || "-"}</TableCell>
                  <TableCell dir="ltr">{o.order_date ? new Date(o.order_date).toLocaleDateString("en-US") : "-"}</TableCell>
                  <TableCell dir="ltr">{formatCurrency(o.total_amount ?? 0)}</TableCell>
                  <TableCell><Badge variant="secondary">{statusLabel[o.status ?? ""] ?? o.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SuppliersReport() {
  const [preset, setPreset] = useState<string>("year");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [detailSupplier, setDetailSupplier] = useState<{ id: string; name: string } | null>(null);

  const dateRange = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) return { start: customStart, end: customEnd };
    return presetRange(preset);
  }, [preset, customStart, customEnd]);

  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["report-suppliers-orders", dateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, supplier_id, total_amount, order_date, status, order_number, suppliers(name, company_name, rating)")
        .gte("order_date", dateRange.start).lte("order_date", dateRange.end);
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["report-suppliers-invoices", dateRange],
    queryFn: async () => {
      const { data } = await supabase.from("invoices" as any)
        .select("id, supplier_id, invoice_number, invoice_date, total_amount, paid_amount, status")
        .gte("invoice_date", dateRange.start).lte("invoice_date", dateRange.end);
      return (data ?? []) as any[];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["report-suppliers-payments", dateRange],
    queryFn: async () => {
      const { data } = await supabase.from("payments" as any)
        .select("id, amount, payment_date, payment_method, invoice_id, invoices(supplier_id, invoice_number)")
        .gte("payment_date", dateRange.start).lte("payment_date", dateRange.end);
      return (data ?? []) as any[];
    },
  });

  const receivedOrders = useMemo(() => (orders ?? []).filter(o => o.status === "received" || o.status === "partial"), [orders]);

  const supplierData = useMemo(() => {
    const grouped: Record<string, { id: string; name: string; count: number; total: number; invoicesTotal: number; paid: number; balance: number; lastOrder: string; rating: number | null }> = {};

    receivedOrders.forEach(o => {
      const name = (o.suppliers as any)?.company_name || (o.suppliers as any)?.name || "غير محدد";
      const rating = (o.suppliers as any)?.rating ?? null;
      if (!grouped[o.supplier_id]) grouped[o.supplier_id] = { id: o.supplier_id, name, count: 0, total: 0, invoicesTotal: 0, paid: 0, balance: 0, lastOrder: "", rating };
      grouped[o.supplier_id].count++;
      grouped[o.supplier_id].total += (o.total_amount ?? 0);
      if (o.order_date && o.order_date > grouped[o.supplier_id].lastOrder) grouped[o.supplier_id].lastOrder = o.order_date;
    });

    (invoices ?? []).forEach((i: any) => {
      if (!i.supplier_id) return;
      if (!grouped[i.supplier_id]) grouped[i.supplier_id] = { id: i.supplier_id, name: "غير محدد", count: 0, total: 0, invoicesTotal: 0, paid: 0, balance: 0, lastOrder: "", rating: null };
      grouped[i.supplier_id].invoicesTotal += (i.total_amount ?? 0);
      grouped[i.supplier_id].paid += (i.paid_amount ?? 0);
    });

    Object.values(grouped).forEach(g => { g.balance = g.invoicesTotal - g.paid; });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [receivedOrders, invoices]);

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
        ))}
      </div>
    );
  };

  const exportCSV = () => {
    const headers = ["المورد", "عدد الطلبيات", "إجمالي المشتريات", "إجمالي الفواتير", "المدفوع", "المتبقي", "آخر طلبية"];
    const rows = supplierData.map(s => [s.name, s.count, s.total.toFixed(2), s.invoicesTotal.toFixed(2), s.paid.toFixed(2), s.balance.toFixed(2), s.lastOrder]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `suppliers-report-${dateRange.start}_${dateRange.end}.csv`; a.click();
  };

  const totalPurchases = supplierData.reduce((s, x) => s + x.total, 0);
  const totalBalance = supplierData.reduce((s, x) => s + x.balance, 0);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">هذا الشهر</SelectItem>
            <SelectItem value="last_month">الشهر الماضي</SelectItem>
            <SelectItem value="quarter">آخر 3 أشهر</SelectItem>
            <SelectItem value="year">هذا العام</SelectItem>
            <SelectItem value="last_year">العام الماضي</SelectItem>
            <SelectItem value="custom">فترة مخصصة</SelectItem>
          </SelectContent>
        </Select>
        {preset === "custom" && (
          <>
            <Input type="date" dir="ltr" className="w-40" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-muted-foreground">إلى</span>
            <Input type="date" dir="ltr" className="w-40" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </>
        )}
        <Button variant="outline" size="sm" onClick={exportCSV}><Download className="ml-2 h-4 w-4" />تصدير CSV</Button>
        <span className="text-xs text-muted-foreground mr-auto" dir="ltr">{dateRange.start} → {dateRange.end}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">عدد الموردين</CardTitle></CardHeader><CardContent><div className="text-xl font-bold" dir="ltr">{supplierData.length.toLocaleString("en-US")}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">إجمالي المشتريات</CardTitle></CardHeader><CardContent><div className="text-xl font-bold" dir="ltr">{formatCurrency(totalPurchases)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">إجمالي الأرصدة المستحقة</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${totalBalance > 0 ? "text-destructive" : ""}`} dir="ltr">{formatCurrency(totalBalance)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loadingOrders ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المورد</TableHead>
                  <TableHead>عدد الطلبيات</TableHead>
                  <TableHead>إجمالي المشتريات</TableHead>
                  <TableHead>إجمالي الفواتير</TableHead>
                  <TableHead>المدفوع</TableHead>
                  <TableHead>الرصيد المستحق</TableHead>
                  <TableHead>آخر طلبية</TableHead>
                  <TableHead>التقييم</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierData.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell dir="ltr">{s.count.toLocaleString("en-US")}</TableCell>
                    <TableCell dir="ltr" className="font-semibold">{formatCurrency(s.total)}</TableCell>
                    <TableCell dir="ltr">{formatCurrency(s.invoicesTotal)}</TableCell>
                    <TableCell dir="ltr">{formatCurrency(s.paid)}</TableCell>
                    <TableCell dir="ltr" className={s.balance > 0 ? "text-destructive font-semibold" : ""}>{formatCurrency(s.balance)}</TableCell>
                    <TableCell dir="ltr">{s.lastOrder ? new Date(s.lastOrder).toLocaleDateString("en-US") : "-"}</TableCell>
                    <TableCell>{renderStars(s.rating)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailSupplier({ id: s.id, name: s.name })}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {supplierData.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailSupplier} onOpenChange={(o) => !o && setDetailSupplier(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader><DialogTitle>كشف حساب المورد: {detailSupplier?.name}</DialogTitle></DialogHeader>
          {detailSupplier && (
            <SupplierAccountDetail
              supplierId={detailSupplier.id}
              orders={(orders ?? []).filter(o => o.supplier_id === detailSupplier.id)}
              invoices={(invoices ?? []).filter((i: any) => i.supplier_id === detailSupplier.id)}
              payments={(payments ?? []).filter((p: any) => p.invoices?.supplier_id === detailSupplier.id)}
              dateRange={dateRange}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierAccountDetail({ orders, invoices, payments, dateRange }: { supplierId: string; orders: any[]; invoices: any[]; payments: any[]; dateRange: { start: string; end: string } }) {
  const receivedOrders = orders.filter(o => o.status === "received" || o.status === "partial");
  const totalPurchases = receivedOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const totalInvoices = invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount ?? 0), 0);
  const balance = totalInvoices - totalPaid;

  const statusLabel: Record<string, string> = { pending: "معلقة", awaiting_approval: "بانتظار الموافقة", approved: "تمت الموافقة", received: "مستلمة", partial: "جزئية", cancelled: "ملغاة" };
  const invStatus: Record<string, string> = { unpaid: "غير مدفوعة", partial: "جزئية", paid: "مدفوعة", overdue: "متأخرة" };

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground" dir="ltr">{dateRange.start} → {dateRange.end}</div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">المشتريات</CardTitle></CardHeader><CardContent><div className="text-lg font-bold" dir="ltr">{formatCurrency(totalPurchases)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">إجمالي الفواتير</CardTitle></CardHeader><CardContent><div className="text-lg font-bold" dir="ltr">{formatCurrency(totalInvoices)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">المدفوع</CardTitle></CardHeader><CardContent><div className="text-lg font-bold text-accent" dir="ltr">{formatCurrency(totalPaid)}</div></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">الرصيد المستحق</CardTitle></CardHeader><CardContent><div className={`text-lg font-bold ${balance > 0 ? "text-destructive" : ""}`} dir="ltr">{formatCurrency(balance)}</div></CardContent></Card>
      </div>

      <div>
        <h3 className="font-semibold mb-2">الطلبيات ({orders.length})</h3>
        <Table>
          <TableHeader><TableRow><TableHead>رقم الطلبية</TableHead><TableHead>التاريخ</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
          <TableBody>
            {orders.map(o => (
              <TableRow key={o.id}>
                <TableCell dir="ltr" className="font-mono text-sm">{o.order_number}</TableCell>
                <TableCell dir="ltr">{o.order_date ? new Date(o.order_date).toLocaleDateString("en-US") : "-"}</TableCell>
                <TableCell dir="ltr">{formatCurrency(o.total_amount ?? 0)}</TableCell>
                <TableCell><Badge variant="secondary">{statusLabel[o.status] ?? o.status}</Badge></TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد طلبيات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="font-semibold mb-2">الفواتير ({invoices.length})</h3>
        <Table>
          <TableHeader><TableRow><TableHead>رقم الفاتورة</TableHead><TableHead>التاريخ</TableHead><TableHead>الإجمالي</TableHead><TableHead>المدفوع</TableHead><TableHead>المتبقي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
          <TableBody>
            {invoices.map(i => (
              <TableRow key={i.id}>
                <TableCell dir="ltr" className="font-mono text-sm">{i.invoice_number}</TableCell>
                <TableCell dir="ltr">{new Date(i.invoice_date).toLocaleDateString("en-US")}</TableCell>
                <TableCell dir="ltr">{formatCurrency(i.total_amount ?? 0)}</TableCell>
                <TableCell dir="ltr">{formatCurrency(i.paid_amount ?? 0)}</TableCell>
                <TableCell dir="ltr" className={((i.total_amount ?? 0) - (i.paid_amount ?? 0)) > 0 ? "text-destructive" : ""}>{formatCurrency((i.total_amount ?? 0) - (i.paid_amount ?? 0))}</TableCell>
                <TableCell><Badge variant="secondary">{invStatus[i.status] ?? i.status}</Badge></TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">لا توجد فواتير</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="font-semibold mb-2">المدفوعات ({payments.length})</h3>
        <Table>
          <TableHeader><TableRow><TableHead>رقم الفاتورة</TableHead><TableHead>التاريخ</TableHead><TableHead>المبلغ</TableHead><TableHead>الطريقة</TableHead></TableRow></TableHeader>
          <TableBody>
            {payments.map(p => (
              <TableRow key={p.id}>
                <TableCell dir="ltr" className="font-mono text-sm">{p.invoices?.invoice_number ?? "-"}</TableCell>
                <TableCell dir="ltr">{new Date(p.payment_date).toLocaleDateString("en-US")}</TableCell>
                <TableCell dir="ltr" className="text-accent font-semibold">{formatCurrency(p.amount ?? 0)}</TableCell>
                <TableCell>{p.payment_method === "cash" ? "نقدي" : p.payment_method === "bank_transfer" ? "تحويل بنكي" : p.payment_method === "check" ? "شيك" : "أخرى"}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">لا توجد مدفوعات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const FCOLORS = ["hsl(217, 91%, 50%)", "hsl(151, 55%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)", "hsl(190, 70%, 45%)", "hsl(330, 60%, 50%)", "hsl(50, 80%, 50%)"];
const ARABIC_MONTHS_F = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function FinancialReport() {
  const now = new Date();
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split("T")[0]);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split("T")[0];

  const { data: ordersData } = useQuery({
    queryKey: ["fin-orders", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("total_amount").in("status", ["received", "partial"]).gte("order_date", startDate).lte("order_date", endDate);
      return data ?? [];
    },
  });

  const { data: invoicesData } = useQuery({
    queryKey: ["fin-invoices", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("invoices" as any).select("*, suppliers(name, company_name)").gte("invoice_date", startDate).lte("invoice_date", endDate);
      return (data ?? []) as any[];
    },
  });

  const { data: expensesData } = useQuery({
    queryKey: ["fin-expenses", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("expenses" as any).select("amount, category").gte("expense_date", startDate).lte("expense_date", endDate);
      return (data ?? []) as any[];
    },
  });

  const { data: paymentsData } = useQuery({
    queryKey: ["fin-payments", startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase.from("payments" as any).select("amount").gte("payment_date", startDate).lte("payment_date", endDate);
      return (data ?? []) as any[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["fin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, current_stock, purchase_price, selling_price").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["fin-sales", startDate, endDate],
    queryFn: async () => {
      const { data } = await (supabase.from("sales" as any) as any).select("total_amount, status").gte("created_at", `${startDate}T00:00:00`).lte("created_at", `${endDate}T23:59:59`);
      return ((data ?? []) as any[]).filter((s: any) => s.status === "completed");
    },
  });

  const { data: saleItemsData } = useQuery({
    queryKey: ["fin-sale-items", startDate, endDate],
    queryFn: async () => {
      const { data: sales } = await (supabase.from("sales" as any) as any).select("id").gte("created_at", `${startDate}T00:00:00`).lte("created_at", `${endDate}T23:59:59`).eq("status", "completed");
      if (!sales?.length) return [];
      const ids = (sales as any[]).map((s: any) => s.id);
      const { data } = await (supabase.from("sale_items" as any) as any).select("product_id, product_name, quantity, unit_price, total_price").in("sale_id", ids);
      return (data ?? []) as any[];
    },
  });

  const { data: chartOrders } = useQuery({
    queryKey: ["fin-chart-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("created_at, total_amount").in("status", ["received", "partial"]).gte("created_at", sixMonthsAgo);
      return data ?? [];
    },
  });

  const { data: chartExpenses } = useQuery({
    queryKey: ["fin-chart-expenses"],
    queryFn: async () => {
      const { data } = await supabase.from("expenses" as any).select("expense_date, amount").gte("expense_date", sixMonthsAgo);
      return (data ?? []) as any[];
    },
  });

  const { data: chartSales } = useQuery({
    queryKey: ["fin-chart-sales"],
    queryFn: async () => {
      const { data } = await (supabase.from("sales" as any) as any).select("created_at, total_amount, status").gte("created_at", sixMonthsAgo);
      return ((data ?? []) as any[]).filter((s: any) => s.status === "completed");
    },
  });

  const totalPurchases = ordersData?.reduce((s, o) => s + (o.total_amount ?? 0), 0) ?? 0;
  const totalInvoicesPaid = invoicesData?.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.paid_amount ?? 0), 0) ?? 0;
  const totalExpenses = expensesData?.reduce((s: number, e: any) => s + (e.amount ?? 0), 0) ?? 0;
  const totalPayments = paymentsData?.reduce((s: number, p: any) => s + (p.amount ?? 0), 0) ?? 0;
  const stockValue = products?.reduce((s, p) => s + (p.current_stock ?? 0) * (p.purchase_price ?? 0), 0) ?? 0;
  const netCosts = totalInvoicesPaid + totalExpenses;
  const totalSales = salesData?.reduce((s: number, sale: any) => s + (sale.total_amount ?? 0), 0) ?? 0;

  const grossProfit = useMemo(() => {
    if (!saleItemsData || !products) return 0;
    const productMap: Record<string, number> = {};
    products.forEach(p => { productMap[p.id] = p.purchase_price ?? 0; });
    return (saleItemsData as any[]).reduce((s: number, item: any) => {
      const pp = productMap[item.product_id] ?? 0;
      return s + ((item.unit_price - pp) * item.quantity);
    }, 0);
  }, [saleItemsData, products]);

  const topProducts = useMemo(() => {
    if (!saleItemsData || !products) return [];
    const productMap: Record<string, number> = {};
    products.forEach(p => { productMap[p.id] = p.purchase_price ?? 0; });
    const grouped: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
    (saleItemsData as any[]).forEach((item: any) => {
      const pid = item.product_id ?? "unknown";
      if (!grouped[pid]) grouped[pid] = { name: item.product_name, qty: 0, revenue: 0, profit: 0 };
      grouped[pid].qty += item.quantity;
      grouped[pid].revenue += item.total_price;
      grouped[pid].profit += (item.unit_price - (productMap[pid] ?? 0)) * item.quantity;
    });
    return Object.values(grouped).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [saleItemsData, products]);

  const lineData = useMemo(() => {
    const grouped: Record<string, { purchases: number; expenses: number; sales: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      grouped[`${d.getFullYear()}-${d.getMonth()}`] = { purchases: 0, expenses: 0, sales: 0 };
    }
    chartOrders?.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (k in grouped) grouped[k].purchases += (o.total_amount ?? 0);
    });
    chartExpenses?.forEach((e: any) => {
      if (!e.expense_date) return;
      const d = new Date(e.expense_date);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (k in grouped) grouped[k].expenses += (e.amount ?? 0);
    });
    chartSales?.forEach((s: any) => {
      if (!s.created_at) return;
      const d = new Date(s.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (k in grouped) grouped[k].sales += (s.total_amount ?? 0);
    });
    return Object.entries(grouped).map(([k, v]) => {
      const month = parseInt(k.split("-")[1]);
      return { name: ARABIC_MONTHS_F[month], ...v };
    });
  }, [chartOrders, chartExpenses, chartSales]);

  const pieData = useMemo(() => {
    if (!expensesData) return [];
    const grouped: Record<string, number> = {};
    expensesData.forEach((e: any) => { grouped[e.category] = (grouped[e.category] ?? 0) + (e.amount ?? 0); });
    return Object.entries(grouped).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expensesData]);

  const supplierSummary = useMemo(() => {
    if (!invoicesData) return [];
    const grouped: Record<string, { name: string; count: number; total: number; paid: number }> = {};
    invoicesData.forEach((i: any) => {
      const sid = i.supplier_id ?? "none";
      const name = i.suppliers?.company_name || i.suppliers?.name || "غير محدد";
      if (!grouped[sid]) grouped[sid] = { name, count: 0, total: 0, paid: 0 };
      grouped[sid].count++;
      grouped[sid].total += (i.total_amount ?? 0);
      grouped[sid].paid += (i.paid_amount ?? 0);
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [invoicesData]);

  const kpis = [
    { title: "إجمالي المشتريات", value: formatCurrency(totalPurchases) },
    { title: "إجمالي المبيعات", value: formatCurrency(totalSales) },
    { title: "فواتير مدفوعة", value: formatCurrency(totalInvoicesPaid) },
    { title: "إجمالي المصروفات", value: formatCurrency(totalExpenses) },
    { title: "إجمالي الربح الإجمالي", value: formatCurrency(grossProfit) },
    { title: "قيمة المخزون", value: formatCurrency(stockValue) },
    { title: "إجمالي المدفوعات", value: formatCurrency(totalPayments) },
    { title: "صافي التكاليف", value: formatCurrency(netCosts) },
  ];

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-4 items-center">
        <Input type="date" dir="ltr" className="w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span className="text-muted-foreground">إلى</span>
        <Input type="date" dir="ltr" className="w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <Card key={k.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{k.title}</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold" dir="ltr">{k.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">المشتريات والمبيعات والمصروفات</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="purchases" name="المشتريات" stroke="hsl(217, 91%, 50%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="sales" name="المبيعات" stroke="hsl(151, 55%, 42%)" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" name="المصروفات" stroke="hsl(0, 72%, 51%)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">توزيع المصروفات حسب الفئة</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                    {pieData.map((_, i) => <Cell key={i} fill={FCOLORS[i % FCOLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {topProducts.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">أفضل المنتجات مبيعاً</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المنتج</TableHead>
                  <TableHead>الكمية المباعة</TableHead>
                  <TableHead>الإيرادات</TableHead>
                  <TableHead>الربح</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell dir="ltr">{p.qty.toLocaleString("en-US")}</TableCell>
                    <TableCell dir="ltr">{formatCurrency(p.revenue)}</TableCell>
                    <TableCell dir="ltr" className={p.profit > 0 ? "text-accent" : "text-destructive"}>{formatCurrency(p.profit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">ملخص الفواتير حسب المورد</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المورد</TableHead>
                <TableHead>عدد الفواتير</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>المدفوع</TableHead>
                <TableHead>المتبقي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplierSummary.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell dir="ltr">{s.count}</TableCell>
                  <TableCell dir="ltr">{formatCurrency(s.total)}</TableCell>
                  <TableCell dir="ltr">{formatCurrency(s.paid)}</TableCell>
                  <TableCell dir="ltr" className={s.total - s.paid > 0 ? "text-destructive" : ""}>{formatCurrency(s.total - s.paid)}</TableCell>
                </TableRow>
              ))}
              {supplierSummary.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
