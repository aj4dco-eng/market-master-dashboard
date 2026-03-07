import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, Clock, CheckCircle } from "lucide-react";

const stats = [
  { title: "مبيعاتي اليوم", value: "0", icon: ShoppingCart, color: "text-primary" },
  { title: "المنتجات المتاحة", value: "0", icon: Package, color: "text-accent" },
  { title: "الطلبات المعلقة", value: "0", icon: Clock, color: "text-warning" },
  { title: "الطلبات المكتملة", value: "0", icon: CheckCircle, color: "text-success" },
];

export default function EmployeeDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة تحكم الموظف</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" dir="ltr">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
