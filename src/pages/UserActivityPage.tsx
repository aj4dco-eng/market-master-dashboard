import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, ArrowRight, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type ActivityLog = {
  id: string;
  user_id: string;
  action_type: string;
  module: string;
  description: string;
  details: Record<string, any>;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

const ACTION_TYPE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  login: { label: "تسجيل دخول", variant: "default" },
  logout: { label: "تسجيل خروج", variant: "secondary" },
  create: { label: "إضافة", variant: "default" },
  update: { label: "تعديل", variant: "secondary" },
  delete: { label: "حذف", variant: "destructive" },
  view: { label: "عرض", variant: "outline" },
  export: { label: "تصدير", variant: "outline" },
};

const MODULE_LABELS: Record<string, string> = {
  auth: "المصادقة",
  suppliers: "الموردون",
  products: "المنتجات",
  categories: "الأصناف",
  orders: "الطلبيات",
  inventory: "الجرد",
  sales: "المبيعات",
  pos: "نقطة البيع",
  invoices: "الفواتير",
  expenses: "المصروفات",
  users: "المستخدمون",
  settings: "الإعدادات",
  permissions: "الصلاحيات",
};

export default function UserActivityPage() {
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ["activity-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("created_at");
      return data ?? [];
    },
  });

  // Fetch activity logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ["activity-logs", selectedUserId, selectedModule],
    queryFn: async () => {
      let query = supabase
        .from("activity_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (selectedUserId !== "all") {
        query = query.eq("user_id", selectedUserId);
      }
      if (selectedModule !== "all") {
        query = query.eq("module", selectedModule);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ActivityLog[];
    },
  });

  // Enrich logs with user names
  const enrichedLogs = logs?.map((log) => {
    const u = users?.find((u) => u.id === log.user_id);
    return { ...log, user_name: u?.full_name || "", user_email: u?.email || "" };
  });

  const filteredLogs = enrichedLogs?.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.description.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.user_email?.toLowerCase().includes(q) ||
      log.module.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">سجل حركات المستخدمين</h1>
            <Badge variant="secondary">{filteredLogs?.length ?? 0} سجل</Badge>
          </div>
          <Button variant="outline" onClick={() => navigate("/users")}>
            <ArrowRight className="h-4 w-4 ml-2" />
            العودة للمستخدمين
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث في السجلات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="جميع المستخدمين" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المستخدمين</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="جميع الأقسام" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأقسام</SelectItem>
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ والوقت</TableHead>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>نوع الحركة</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>الوصف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs?.map((log) => {
                    const actionInfo = ACTION_TYPE_LABELS[log.action_type] ?? {
                      label: log.action_type,
                      variant: "outline" as const,
                    };
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm" dir="ltr">
                          {format(new Date(log.created_at), "yyyy/MM/dd HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">{log.user_name || "-"}</div>
                            <div className="text-xs text-muted-foreground" dir="ltr">
                              {log.user_email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionInfo.variant}>{actionInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {MODULE_LABELS[log.module] ?? log.module}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">
                          {log.description}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!filteredLogs || filteredLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                        لا توجد سجلات حركات بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
