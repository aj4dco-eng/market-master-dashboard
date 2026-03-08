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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, Package, Warehouse, TrendingUp, Star } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";

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
  const now = new Date();
  const [range, setRange] = useState<"month" | "last_month" | "year">("month");

  const dateRange = useMemo(() => {
    if (range === "month") return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
    if (range === "last_month") return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0], end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0] };
    return { start: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0], end: now.toISOString().split("T")[0] };
  }, [range]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["report-purchases", dateRange],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("*, suppliers(name)").gte("order_date", dateRange.start).lte("order_date", dateRange.end).order("order_date", { ascending: false });
      return data ?? [];
    },
  });

  const totalOrders = orders?.length ?? 0;
  const totalAmount = orders?.reduce((s, o) => s + (o.total_amount ?? 0), 0) ?? 0;
  const avgAmount = totalOrders > 0 ? totalAmount / totalOrders : 0;

  const chartData = useMemo(() => {
    if (!orders) return [];
    const grouped: Record<string, number> = {};
    orders.forEach(o => {
      if (!o.order_date) return;
      const d = new Date(o.order_date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0];
      grouped[key] = (grouped[key] ?? 0) + (o.total_amount ?? 0);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([week, total]) => ({ name: week, total }));
  }, [orders]);

  const statusLabel: Record<string, string> = { pending: "معلقة", awaiting_approval: "بانتظار الموافقة", received: "مستلمة", partial: "جزئية", cancelled: "ملغاة" };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex gap-2">
        <Button variant={range === "month" ? "default" : "outline"} size="sm" onClick={() => setRange("month")}>هذا الشهر</Button>
        <Button variant={range === "last_month" ? "default" : "outline"} size="sm" onClick={() => setRange("last_month")}>الشهر الماضي</Button>
        <Button variant={range === "year" ? "default" : "outline"} size="sm" onClick={() => setRange("year")}>هذا العام</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: "إجمالي الطلبيات", value: totalOrders.toLocaleString("en-US") },
          { title: "إجمالي المبلغ", value: formatCurrency(totalAmount) },
          { title: "متوسط قيمة الطلبية", value: formatCurrency(avgAmount) },
        ].map(s => (
          <Card key={s.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.title}</CardTitle></CardHeader>
            <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-xl font-bold" dir="ltr">{s.value}</div>}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">المشتريات حسب الأسبوع</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
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
                  <TableCell>{(o.suppliers as any)?.name ?? "-"}</TableCell>
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
  const { data: orders, isLoading } = useQuery({
    queryKey: ["report-suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("supplier_id, total_amount, order_date, suppliers(name, rating)");
      return data ?? [];
    },
  });

  const supplierData = useMemo(() => {
    if (!orders) return [];
    const grouped: Record<string, { name: string; count: number; total: number; lastOrder: string; rating: number | null }> = {};
    orders.forEach(o => {
      const name = (o.suppliers as any)?.name ?? "غير محدد";
      const rating = (o.suppliers as any)?.rating ?? null;
      if (!grouped[o.supplier_id]) grouped[o.supplier_id] = { name, count: 0, total: 0, lastOrder: "", rating };
      grouped[o.supplier_id].count++;
      grouped[o.supplier_id].total += (o.total_amount ?? 0);
      if (o.order_date && o.order_date > grouped[o.supplier_id].lastOrder) grouped[o.supplier_id].lastOrder = o.order_date;
    });
    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [orders]);

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

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المورد</TableHead>
                  <TableHead>عدد الطلبيات</TableHead>
                  <TableHead>إجمالي المشتريات</TableHead>
                  <TableHead>آخر طلبية</TableHead>
                  <TableHead>التقييم</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierData.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell dir="ltr">{s.count.toLocaleString("en-US")}</TableCell>
                    <TableCell dir="ltr">{formatCurrency(s.total)}</TableCell>
                    <TableCell dir="ltr">{s.lastOrder ? new Date(s.lastOrder).toLocaleDateString("en-US") : "-"}</TableCell>
                    <TableCell>{renderStars(s.rating)}</TableCell>
                  </TableRow>
                ))}
                {supplierData.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
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
      const { data } = await supabase.from("invoices" as any).select("*, suppliers(name)").gte("invoice_date", startDate).lte("invoice_date", endDate);
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
      const name = i.suppliers?.name ?? "غير محدد";
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
