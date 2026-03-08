import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, ClipboardList, Eye, PackageCheck, X, CheckCircle } from "lucide-react";
import { NewOrderDialog } from "@/components/orders/NewOrderDialog";
import { ReceiveOrderDialog } from "@/components/orders/ReceiveOrderDialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

export interface PurchaseOrder {
  id: string;
  order_number: string;
  supplier_id: string;
  created_by: string | null;
  status: string;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  suppliers?: { name: string; company_name: string | null; single_order_limit: number | null };
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  barcode: string | null;
  product_name: string | null;
  requested_qty: number;
  received_qty: number;
  requested_purchase_price: number;
  actual_purchase_price: number;
  selling_price: number;
  expiry_date: string | null;
  batch_number: string | null;
  notes: string | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "معلقة", variant: "outline" },
  awaiting_approval: { label: "بانتظار الموافقة", variant: "default" },
  approved: { label: "تمت الموافقة", variant: "default" },
  received: { label: "مستلمة", variant: "default" },
  partial: { label: "جزئية", variant: "secondary" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "border-warning/50 bg-warning/10 text-warning",
  awaiting_approval: "border-primary/50 bg-primary/10 text-primary",
  approved: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600",
  received: "border-accent/50 bg-accent/10 text-accent",
  partial: "border-secondary bg-secondary text-secondary-foreground",
  cancelled: "border-destructive/50 bg-destructive/10 text-destructive",
};

export default function PurchaseOrdersPage() {
  const { role } = useAuth();
  const perm = usePermissions();
  const { logActivity } = useActivityLog();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState(searchParams.get("status") || "all");
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, company_name, single_order_limit)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PurchaseOrder[];
    },
  });

  const { data: orderItemCounts = {} } = useQuery({
    queryKey: ["order-item-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("order_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((item) => {
        counts[item.order_id] = (counts[item.order_id] || 0) + 1;
      });
      return counts;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "approved" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({ title: "تمت الموافقة على الطلبية" });
      logActivity({ actionType: "update", module: "orders", description: "الموافقة على طلبية", details: { order_id: id } });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast({ title: "تم إلغاء الطلبية" });
      logActivity({ actionType: "delete", module: "orders", description: "إلغاء طلبية", details: { order_id: id } });
    },
  });

  const filtered = orders.filter((o) => {
    const matchSearch =
      !search ||
      o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.suppliers?.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.suppliers?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusTab === "all" || o.status === statusTab;
    return matchSearch && matchStatus;
  });

  const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">طلبيات الشراء</h1>
            <Badge variant="secondary">{orders.length.toLocaleString("en-US")}</Badge>
          </div>
          {perm.canCreate("orders") && (
            <Button onClick={() => setNewOrderOpen(true)}>
              <Plus className="ml-2 h-4 w-4" />
              طلبية جديدة
            </Button>
          )}
        </div>

        {/* Status tabs */}
        <Tabs value={statusTab} onValueChange={setStatusTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="pending">معلقة</TabsTrigger>
            <TabsTrigger value="awaiting_approval">بانتظار الموافقة</TabsTrigger>
            <TabsTrigger value="approved">تمت الموافقة</TabsTrigger>
            <TabsTrigger value="received">مستلمة</TabsTrigger>
            <TabsTrigger value="partial">جزئية</TabsTrigger>
            <TabsTrigger value="cancelled">ملغاة</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الطلبية أو اسم المورد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="mx-auto h-12 w-12 mb-3 opacity-30" />
            لا توجد طلبيات
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الطلبية</TableHead>
                  <TableHead>المورد</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>عدد الأصناف</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell dir="ltr" className="text-right font-mono text-sm">
                      {order.order_number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.suppliers?.company_name || order.suppliers?.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(order.order_date).toLocaleDateString("en-GB")}
                    </TableCell>
                    <TableCell>{(orderItemCounts[order.id] || 0).toLocaleString("en-US")}</TableCell>
                    <TableCell dir="ltr" className="text-right font-semibold">
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[order.status] || ""}`}>
                        {STATUS_MAP[order.status]?.label || order.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewOrderId(order.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === "awaiting_approval" && role === "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
                            onClick={() => approveMutation.mutate(order.id)}
                            title="موافقة"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {(order.status === "pending" || order.status === "approved") && perm.canEdit("orders") && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReceiveOrderId(order.id)}>
                            <PackageCheck className="h-4 w-4" />
                          </Button>
                        )}
                        {(order.status === "pending" || order.status === "awaiting_approval") && perm.canDelete("orders") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => cancelMutation.mutate(order.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewOrderDialog open={newOrderOpen} onOpenChange={setNewOrderOpen} />

      {receiveOrderId && (
        <ReceiveOrderDialog
          orderId={receiveOrderId}
          open={!!receiveOrderId}
          onOpenChange={(open) => !open && setReceiveOrderId(null)}
        />
      )}

      {/* View order reuses receive dialog in read-only mode */}
      {viewOrderId && (
        <ReceiveOrderDialog
          orderId={viewOrderId}
          open={!!viewOrderId}
          onOpenChange={(open) => !open && setViewOrderId(null)}
          readOnly
        />
      )}
    </DashboardLayout>
  );
}
