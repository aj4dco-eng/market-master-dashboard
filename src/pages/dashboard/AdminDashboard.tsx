import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, ShoppingCart, Warehouse, AlertTriangle, Clock, Receipt, ReceiptText, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const ARABIC_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = now.toISOString().split("T")[0];
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const { data: productCount, isLoading: l1 } = useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: supplierCount, isLoading: l2 } = useQuery({
    queryKey: ["admin-suppliers-count"],
    queryFn: async () => {
      const { count } = await supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("is_active", true);
      return count ?? 0;
    },
  });

  const { data: monthlyOrders, isLoading: l3 } = useQuery({
    queryKey: ["admin-monthly-orders"],
    queryFn: async () => {
      const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).gte("order_date", startOfMonth);
      return count ?? 0;
    },
  });

  const { data: products, isLoading: l4 } = useQuery({
    queryKey: ["admin-products-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("current_stock, purchase_price, min_stock_alert").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: pendingOrders, isLoading: l5 } = useQuery({
    queryKey: ["admin-pending-orders"],
    queryFn: async () => {
      const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).in("status", ["pending", "awaiting_approval"]);
      return count ?? 0;
    },
  });

  const { data: awaitingApproval, isLoading: l6 } = useQuery({
    queryKey: ["admin-awaiting-approval"],
    queryFn: async () => {
      const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "awaiting_approval");
      return count ?? 0;
    },
  });

  const { data: todaySales } = useQuery({
    queryKey: ["admin-today-sales"],
    queryFn: async () => {
      const { data } = await (supabase.from("sales" as any) as any).select("total_amount, status").gte("created_at", `${today}T00:00:00`).lte("created_at", `${today}T23:59:59`);
      const completed = ((data ?? []) as any[]).filter((s: any) => s.status === "completed");
      return { total: completed.reduce((s: number, sale: any) => s + (sale.total_amount ?? 0), 0), count: completed.length };
    },
  });

  const { data: chartOrders } = useQuery({
    queryKey: ["admin-chart-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("created_at, total_amount").gte("created_at", sixMonthsAgo);
      return data ?? [];
    },
  });

  const { data: chartSales } = useQuery({
    queryKey: ["admin-chart-sales"],
    queryFn: async () => {
      const { data } = await (supabase.from("sales" as any) as any).select("created_at, total_amount, status").gte("created_at", sixMonthsAgo);
      return ((data ?? []) as any[]).filter((s: any) => s.status === "completed");
    },
  });

  const stockValue = useMemo(() => {
    if (!products) return 0;
    return products.reduce((sum, p) => sum + (p.current_stock ?? 0) * (p.purchase_price ?? 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    if (!products) return 0;
    return products.filter(p => (p.min_stock_alert ?? 0) > 0 && (p.current_stock ?? 0) <= (p.min_stock_alert ?? 0)).length;
  }, [products]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { purchases: number; sales: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      grouped[`${d.getFullYear()}-${d.getMonth()}`] = { purchases: 0, sales: 0 };
    }
    chartOrders?.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in grouped) grouped[key].purchases += (o.total_amount ?? 0);
    });
    chartSales?.forEach((s: any) => {
      if (!s.created_at) return;
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in grouped) grouped[key].sales += (s.total_amount ?? 0);
    });
    return Object.entries(grouped).map(([key]) => {
      const [, month] = key.split("-");
      return { name: ARABIC_MONTHS[parseInt(month)], ...grouped[key] };
    });
  }, [chartOrders, chartSales]);

  const isLoading = l1 || l2 || l3 || l4 || l5 || l6;

  const stats = [
    { title: "إجمالي المنتجات", value: productCount?.toLocaleString("en-US") ?? "0", icon: Package, color: "text-primary" },
    { title: "الموردون النشطون", value: supplierCount?.toLocaleString("en-US") ?? "0", icon: Truck, color: "text-accent" },
    { title: "طلبيات هذا الشهر", value: monthlyOrders?.toLocaleString("en-US") ?? "0", icon: ShoppingCart, color: "text-warning" },
    { title: "قيمة المخزون الإجمالية", value: formatCurrency(stockValue), icon: Warehouse, color: "text-primary" },
    { title: "منتجات تحت الحد الأدنى", value: lowStockCount.toLocaleString("en-US"), icon: AlertTriangle, color: lowStockCount > 0 ? "text-destructive" : "text-muted-foreground" },
    { title: "طلبيات معلقة", value: pendingOrders?.toLocaleString("en-US") ?? "0", icon: Clock, color: "text-warning", link: "/orders?status=pending" },
    { title: "بانتظار الموافقة", value: (awaitingApproval ?? 0).toLocaleString("en-US"), icon: ShieldCheck, color: (awaitingApproval ?? 0) > 0 ? "text-destructive" : "text-muted-foreground", link: "/orders?status=awaiting_approval" },
    { title: "مبيعات اليوم", value: formatCurrency(todaySales?.total ?? 0), icon: Receipt, color: "text-accent" },
    { title: "عدد فواتير اليوم", value: (todaySales?.count ?? 0).toLocaleString("en-US"), icon: ReceiptText, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة تحكم المدير</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold" dir="ltr">{stat.value}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">المشتريات والمبيعات خلال 6 أشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="purchases" name="المشتريات" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sales" name="المبيعات" fill="hsl(151, 55%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
