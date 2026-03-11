import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, AlertTriangle, ShoppingCart, CheckCircle, Receipt, ReceiptText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const { data: products, isLoading: l1 } = useQuery({
    queryKey: ["emp-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("name, current_stock, min_stock_alert, supplier_id, suppliers(name, company_name)").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: myOrdersCount, isLoading: l2 } = useQuery({
    queryKey: ["emp-my-orders"],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("created_by", user.id).gte("order_date", startOfMonth);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: receivedCount, isLoading: l3 } = useQuery({
    queryKey: ["emp-received"],
    queryFn: async () => {
      const { count } = await supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "received").gte("order_date", startOfMonth);
      return count ?? 0;
    },
  });

  const { data: mySalesToday } = useQuery({
    queryKey: ["emp-my-sales-today"],
    queryFn: async () => {
      if (!user) return { total: 0, count: 0 };
      const { data } = await (supabase.from("sales" as any) as any)
        .select("total_amount, status")
        .eq("cashier_id", user.id)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      const completed = ((data ?? []) as any[]).filter((s: any) => s.status === "completed");
      return {
        total: completed.reduce((s: number, sale: any) => s + (sale.total_amount ?? 0), 0),
        count: completed.length,
      };
    },
    enabled: !!user,
  });

  const activeCount = products?.length ?? 0;
  const lowStockProducts = useMemo(() => {
    if (!products) return [];
    return products
      .filter(p => (p.min_stock_alert ?? 0) > 0 && (p.current_stock ?? 0) <= (p.min_stock_alert ?? 0))
      .sort((a, b) => {
        const ra = (a.min_stock_alert ?? 1) > 0 ? (a.current_stock ?? 0) / (a.min_stock_alert ?? 1) : 1;
        const rb = (b.min_stock_alert ?? 1) > 0 ? (b.current_stock ?? 0) / (b.min_stock_alert ?? 1) : 1;
        return ra - rb;
      })
      .slice(0, 10);
  }, [products]);

  const isLoading = l1 || l2 || l3;

  const stats = [
    { title: "المنتجات المتاحة", value: activeCount.toLocaleString("en-US"), icon: Package, color: "text-primary" },
    { title: "منتجات منخفضة المخزون", value: lowStockProducts.length.toLocaleString("en-US"), icon: AlertTriangle, color: lowStockProducts.length > 0 ? "text-destructive" : "text-muted-foreground" },
    { title: "طلبياتي هذا الشهر", value: myOrdersCount?.toLocaleString("en-US") ?? "0", icon: ShoppingCart, color: "text-warning" },
    { title: "طلبيات مستلمة هذا الشهر", value: receivedCount?.toLocaleString("en-US") ?? "0", icon: CheckCircle, color: "text-accent" },
    { title: "مبيعاتي اليوم", value: formatCurrency(mySalesToday?.total ?? 0), icon: Receipt, color: "text-accent" },
    { title: "عدد فواتيري اليوم", value: (mySalesToday?.count ?? 0).toLocaleString("en-US"), icon: ReceiptText, color: "text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة تحكم الموظف</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {lowStockProducts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">منتجات تحت الحد الأدنى</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم المنتج</TableHead>
                    <TableHead>المخزون الحالي</TableHead>
                    <TableHead>الحد الأدنى</TableHead>
                    <TableHead>المورد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell dir="ltr" className="text-destructive font-semibold">{(p.current_stock ?? 0).toLocaleString("en-US")}</TableCell>
                      <TableCell dir="ltr">{(p.min_stock_alert ?? 0).toLocaleString("en-US")}</TableCell>
                      <TableCell>{(p.suppliers as any)?.company_name || (p.suppliers as any)?.name || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
