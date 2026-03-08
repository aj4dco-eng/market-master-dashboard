import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, TrendingUp, Warehouse, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMemo } from "react";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const COLORS = ["hsl(217, 91%, 50%)", "hsl(151, 55%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)"];

export default function AccountantDashboard() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];

  const { data: orders } = useQuery({
    queryKey: ["acc-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("purchase_orders").select("*, suppliers(name)").in("status", ["received", "partial"]);
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["acc-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("current_stock, purchase_price").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: awaitingCount, isLoading: l1 } = useQuery({
    queryKey: ["acc-awaiting"],
    queryFn: async () => {
      const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "awaiting_approval");
      return count ?? 0;
    },
  });

  const monthlyPurchases = useMemo(() => {
    if (!orders) return 0;
    return orders.filter(o => o.order_date && o.order_date >= startOfMonth).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  }, [orders, startOfMonth]);

  const yearlyPurchases = useMemo(() => {
    if (!orders) return 0;
    return orders.filter(o => o.order_date && o.order_date >= startOfYear).reduce((s, o) => s + (o.total_amount ?? 0), 0);
  }, [orders, startOfYear]);

  const stockValue = useMemo(() => {
    if (!products) return 0;
    return products.reduce((s, p) => s + (p.current_stock ?? 0) * (p.purchase_price ?? 0), 0);
  }, [products]);

  const recentOrders = useMemo(() => {
    if (!orders) return [];
    return [...orders].sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()).slice(0, 10);
  }, [orders]);

  const pieData = useMemo(() => {
    if (!orders) return [];
    const grouped: Record<string, { name: string; value: number }> = {};
    orders.forEach(o => {
      const name = (o.suppliers as any)?.name ?? "غير محدد";
      if (!grouped[o.supplier_id]) grouped[o.supplier_id] = { name, value: 0 };
      grouped[o.supplier_id].value += (o.total_amount ?? 0);
    });
    return Object.values(grouped).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [orders]);

  const stats = [
    { title: "مشتريات هذا الشهر", value: formatCurrency(monthlyPurchases), icon: ShoppingCart, color: "text-primary" },
    { title: "مشتريات هذا العام", value: formatCurrency(yearlyPurchases), icon: TrendingUp, color: "text-accent" },
    { title: "قيمة المخزون الحالية", value: formatCurrency(stockValue), icon: Warehouse, color: "text-warning" },
    { title: "بانتظار الموافقة", value: awaitingCount?.toLocaleString("en-US") ?? "0", icon: Clock, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة تحكم المحاسب</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                {l1 ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold" dir="ltr">{stat.value}</div>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">آخر 10 طلبيات مستلمة</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الطلبية</TableHead>
                    <TableHead>المورد</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOrders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell dir="ltr" className="font-mono">{o.order_number}</TableCell>
                      <TableCell>{(o.suppliers as any)?.name ?? "-"}</TableCell>
                      <TableCell dir="ltr">{o.order_date ? new Date(o.order_date).toLocaleDateString("en-US") : "-"}</TableCell>
                      <TableCell dir="ltr">{formatCurrency(o.total_amount ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                  {recentOrders.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا توجد طلبيات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">توزيع المشتريات حسب المورد</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name }) => name}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
