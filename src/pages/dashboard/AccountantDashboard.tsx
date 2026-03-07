import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, FileText, TrendingUp, TrendingDown } from "lucide-react";

const stats = [
  { title: "الإيرادات", value: "₪0.00", icon: TrendingUp, color: "text-success" },
  { title: "المصروفات", value: "₪0.00", icon: TrendingDown, color: "text-destructive" },
  { title: "الفواتير المعلقة", value: "0", icon: FileText, color: "text-warning" },
  { title: "صافي الربح", value: "₪0.00", icon: Calculator, color: "text-primary" },
];

export default function AccountantDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">لوحة تحكم المحاسب</h1>
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
