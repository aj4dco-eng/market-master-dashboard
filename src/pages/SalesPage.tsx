import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Receipt, Eye, XCircle, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const paymentLabel: Record<string, string> = { cash: "نقد", card: "بطاقة", other: "أخرى" };
const statusLabel: Record<string, string> = { completed: "مكتملة", cancelled: "ملغاة", refunded: "مرتجعة" };

export default function SalesPage() {
  const { user, role } = useAuth();
  const perm = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = new Date();

  const [range, setRange] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [searchNum, setSearchNum] = useState("");
  const [payFilter, setPayFilter] = useState("all");
  const [detailSale, setDetailSale] = useState<any>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const today = now.toISOString().split("T")[0];
    if (range === "today") return { start: today, end: today };
    if (range === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      return { start: d.toISOString().split("T")[0], end: today };
    }
    if (range === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], end: today };
    return { start: customStart || today, end: customEnd || today };
  }, [range, customStart, customEnd]);

  const { data: sales, isLoading } = useQuery({
    queryKey: ["sales", dateRange],
    queryFn: async () => {
      let q = (supabase.from("sales" as any) as any).select("*, profiles!sales_cashier_id_fkey(full_name)").order("created_at", { ascending: false });
      if (dateRange.start) q = q.gte("created_at", `${dateRange.start}T00:00:00`);
      if (dateRange.end) q = q.lte("created_at", `${dateRange.end}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: saleItemsCounts } = useQuery({
    queryKey: ["sale-items-counts", dateRange],
    queryFn: async () => {
      if (!sales?.length) return {};
      const ids = sales.map((s: any) => s.id);
      const { data } = await (supabase.from("sale_items" as any) as any).select("sale_id").in("sale_id", ids);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((item: any) => { counts[item.sale_id] = (counts[item.sale_id] ?? 0) + 1; });
      return counts;
    },
    enabled: !!sales?.length,
  });

  const filtered = useMemo(() => {
    if (!sales) return [];
    let result = sales;
    if (searchNum) result = result.filter((s: any) => s.sale_number?.includes(searchNum));
    if (payFilter !== "all") result = result.filter((s: any) => s.payment_method === payFilter);
    return result;
  }, [sales, searchNum, payFilter]);

  const summary = useMemo(() => {
    const completed = filtered.filter((s: any) => s.status === "completed");
    const total = completed.reduce((s: number, sale: any) => s + (sale.total_amount ?? 0), 0);
    const count = completed.length;
    const avg = count > 0 ? total / count : 0;
    const discount = completed.reduce((s: number, sale: any) => s + (sale.discount_amount ?? 0), 0);
    return { total, count, avg, discount };
  }, [filtered]);

  // Chart data
  const chartData = useMemo(() => {
    if (!filtered) return [];
    if (range === "today") {
      const hours: Record<number, number> = {};
      for (let i = 0; i < 24; i++) hours[i] = 0;
      filtered.filter((s: any) => s.status === "completed").forEach((s: any) => {
        const h = new Date(s.created_at).getHours();
        hours[h] += (s.total_amount ?? 0);
      });
      return Object.entries(hours).map(([h, v]) => ({ name: `${h}:00`, total: v }));
    }
    const days: Record<string, number> = {};
    filtered.filter((s: any) => s.status === "completed").forEach((s: any) => {
      const d = new Date(s.created_at).toISOString().split("T")[0];
      days[d] = (days[d] ?? 0) + (s.total_amount ?? 0);
    });
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ name: d, total: v }));
  }, [filtered, range]);

  const handleDetail = async (sale: any) => {
    const { data } = await (supabase.from("sale_items" as any) as any).select("*").eq("sale_id", sale.id);
    setDetailSale({ ...sale, items: data ?? [] });
  };

  const cancelSale = useMutation({
    mutationFn: async (saleId: string) => {
      const { data: items } = await (supabase.from("sale_items" as any) as any).select("*").eq("sale_id", saleId);
      await (supabase.from("sales" as any) as any).update({ status: "cancelled" }).eq("id", saleId);
      for (const item of (items ?? []) as any[]) {
        const { data: product } = await supabase.from("products").select("current_stock").eq("id", item.product_id).single();
        await supabase.from("products").update({
          current_stock: (product?.current_stock ?? 0) + item.quantity,
        }).eq("id", item.product_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      setCancelId(null);
      toast.success("تم إلغاء البيع واستعادة المخزون");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const today = now.toISOString().split("T")[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">المبيعات</h1>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>
          {perm.canView("pos") && (
            <Button onClick={() => navigate("/pos")}><ShoppingCart className="ml-2 h-4 w-4" />نقطة البيع</Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          {(["today", "week", "month", "custom"] as const).map(r => (
            <Button key={r} variant={range === r ? "default" : "outline"} size="sm" onClick={() => setRange(r)}>
              {r === "today" ? "اليوم" : r === "week" ? "هذا الأسبوع" : r === "month" ? "هذا الشهر" : "مخصص"}
            </Button>
          ))}
          {range === "custom" && (
            <>
              <Input type="date" dir="ltr" className="w-36" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <Input type="date" dir="ltr" className="w-36" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </>
          )}
          <Input placeholder="بحث برقم البيع..." className="w-48" value={searchNum} onChange={e => setSearchNum(e.target.value)} />
          <Select value={payFilter} onValueChange={setPayFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="cash">نقد</SelectItem>
              <SelectItem value="card">بطاقة</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { title: "إجمالي المبيعات", value: formatCurrency(summary.total) },
            { title: "عدد الفواتير", value: summary.count.toLocaleString("en-US") },
            { title: "متوسط قيمة الفاتورة", value: formatCurrency(summary.avg) },
            { title: "إجمالي الخصومات", value: formatCurrency(summary.discount) },
          ].map(s => (
            <Card key={s.title}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.title}</CardTitle></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl font-bold" dir="ltr">{s.value}</div>}</CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم البيع</TableHead>
                    <TableHead>الكاشير</TableHead>
                    <TableHead>التاريخ والوقت</TableHead>
                    <TableHead>الأصناف</TableHead>
                    <TableHead>الإجمالي</TableHead>
                    <TableHead>المدفوع</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell dir="ltr" className="font-mono">{s.sale_number}</TableCell>
                      <TableCell>{s.profiles?.full_name ?? "-"}</TableCell>
                      <TableCell dir="ltr" className="text-sm">{new Date(s.created_at).toLocaleString("en-US")}</TableCell>
                      <TableCell>{saleItemsCounts?.[s.id] ?? "—"}</TableCell>
                      <TableCell dir="ltr" className="font-semibold">{formatCurrency(s.total_amount ?? 0)}</TableCell>
                      <TableCell dir="ltr">{formatCurrency(s.paid_amount ?? 0)}</TableCell>
                      <TableCell>{paymentLabel[s.payment_method] ?? s.payment_method}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "completed" ? "default" : "destructive"}>
                          {statusLabel[s.status] ?? s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleDetail(s)}><Eye className="h-4 w-4" /></Button>
                          {perm.hasPermission("sales", "cancel") && s.status === "completed" && s.created_at?.split("T")[0] === today && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCancelId(s.id)}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد مبيعات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">{range === "today" ? "المبيعات حسب الساعة" : "المبيعات اليومية"}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="total" fill="hsl(151, 55%, 42%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!detailSale} onOpenChange={() => setDetailSale(null)}>
        <SheetContent side="left" className="w-[450px] sm:w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>تفاصيل البيع</SheetTitle></SheetHeader>
          {detailSale && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">رقم البيع:</span><p className="font-mono" dir="ltr">{detailSale.sale_number}</p></div>
                <div><span className="text-muted-foreground">الكاشير:</span><p>{detailSale.profiles?.full_name ?? "-"}</p></div>
                <div><span className="text-muted-foreground">التاريخ:</span><p dir="ltr">{new Date(detailSale.created_at).toLocaleString("en-US")}</p></div>
                <div><span className="text-muted-foreground">طريقة الدفع:</span><p>{paymentLabel[detailSale.payment_method] ?? detailSale.payment_method}</p></div>
              </div>
              <Separator />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead>الباركود</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>خصم</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailSale.items?.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell dir="ltr" className="text-xs">{item.barcode ?? "-"}</TableCell>
                      <TableCell dir="ltr">{item.quantity}</TableCell>
                      <TableCell dir="ltr">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell dir="ltr">{item.discount_percent}%</TableCell>
                      <TableCell dir="ltr" className="font-semibold">{formatCurrency(item.total_price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator />
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>مجموع فرعي</span><span dir="ltr">{formatCurrency(detailSale.subtotal ?? 0)}</span></div>
                <div className="flex justify-between"><span>خصم</span><span dir="ltr">{formatCurrency(detailSale.discount_amount ?? 0)}</span></div>
                <div className="flex justify-between"><span>ضريبة</span><span dir="ltr">{formatCurrency(detailSale.tax_amount ?? 0)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>الإجمالي</span><span dir="ltr">{formatCurrency(detailSale.total_amount ?? 0)}</span></div>
                <div className="flex justify-between"><span>المدفوع</span><span dir="ltr">{formatCurrency(detailSale.paid_amount ?? 0)}</span></div>
                <div className="flex justify-between"><span>الباقي</span><span dir="ltr">{formatCurrency(detailSale.change_amount ?? 0)}</span></div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => window.print()}>
                <Printer className="ml-2 h-4 w-4" />طباعة الإيصال
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Confirm */}
      <AlertDialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إلغاء البيع</AlertDialogTitle>
            <AlertDialogDescription>سيتم إلغاء هذا البيع واستعادة الكميات للمخزون. هل أنت متأكد؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => cancelId && cancelSale.mutate(cancelId)}>
              إلغاء البيع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
