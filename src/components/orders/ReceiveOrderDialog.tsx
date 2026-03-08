import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActivityLog } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrderItem } from "@/pages/PurchaseOrdersPage";

interface ReceiveOrderDialogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

interface ReceiveItem extends PurchaseOrderItem {
  edit_received_qty: number;
  edit_actual_price: number;
  edit_expiry_date: string;
  edit_batch_number: string;
}

export function ReceiveOrderDialog({ orderId, open, onOpenChange, readOnly = false }: ReceiveOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["purchase-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, company_name)")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["purchase-order-items", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("order_id", orderId);
      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (items.length > 0) {
      setReceiveItems(
        items.map((item) => ({
          ...item,
          edit_received_qty: item.received_qty > 0 ? item.received_qty : item.requested_qty,
          edit_actual_price: item.actual_purchase_price > 0 ? item.actual_purchase_price : item.requested_purchase_price,
          edit_expiry_date: item.expiry_date || "",
          edit_batch_number: item.batch_number || "",
        }))
      );
    }
  }, [items]);

  const updateReceiveItem = (index: number, field: string, value: any) => {
    setReceiveItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const receiveMutation = useMutation({
    mutationFn: async () => {
      // Update each item
      for (const item of receiveItems) {
        const { error: itemErr } = await supabase
          .from("purchase_order_items")
          .update({
            received_qty: item.edit_received_qty,
            actual_purchase_price: item.edit_actual_price,
            expiry_date: item.edit_expiry_date || null,
            batch_number: item.edit_batch_number || null,
          })
          .eq("id", item.id);
        if (itemErr) throw itemErr;

        // Update product stock
        if (item.product_id && item.edit_received_qty > 0) {
          const { data: product } = await supabase
            .from("products")
            .select("current_stock")
            .eq("id", item.product_id)
            .single();

          if (product) {
            const newStock = (product.current_stock ?? 0) + item.edit_received_qty;
            const { error: stockErr } = await supabase
              .from("products")
              .update({ current_stock: newStock })
              .eq("id", item.product_id);
            if (stockErr) throw stockErr;
          }
        }
      }

      // Determine status
      const allReceived = receiveItems.every((i) => i.edit_received_qty >= i.requested_qty);
      const newStatus = allReceived ? "received" : "partial";

      const { error: orderErr } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (orderErr) throw orderErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["order-item-counts"] });
      onOpenChange(false);
      toast({ title: "تم استلام الطلبية بنجاح" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const isLoading = orderLoading || itemsLoading;
  const formatCurrency = (n: number) => `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? "تفاصيل الطلبية" : "استلام الطلبية"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Order info */}
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">رقم الطلبية: </span>
                <span className="font-mono" dir="ltr">{order?.order_number}</span>
              </div>
              <div>
                <span className="text-muted-foreground">المورد: </span>
                <span className="font-medium">{order?.suppliers?.company_name || order?.suppliers?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">التاريخ: </span>
                <span>{new Date(order?.order_date).toLocaleDateString("en-GB")}</span>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead className="w-24">الكمية المطلوبة</TableHead>
                    <TableHead className="w-28">{readOnly ? "المستلم" : "الكمية المستلمة"}</TableHead>
                    <TableHead className="w-32">{readOnly ? "السعر الفعلي" : "سعر الشراء الفعلي (₪)"}</TableHead>
                    {!readOnly && <TableHead className="w-36">تاريخ الصلاحية</TableHead>}
                    {!readOnly && <TableHead className="w-28">رقم الدفعة</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiveItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm font-medium">{item.product_name}</TableCell>
                      <TableCell dir="ltr" className="text-right">
                        {item.requested_qty.toLocaleString("en-US")}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span dir="ltr">{item.received_qty.toLocaleString("en-US")}</span>
                        ) : (
                          <Input
                            type="number"
                            dir="ltr"
                            min="0"
                            value={item.edit_received_qty}
                            onChange={(e) => updateReceiveItem(index, "edit_received_qty", Number(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {readOnly ? (
                          <span dir="ltr">{formatCurrency(item.actual_purchase_price)}</span>
                        ) : (
                          <Input
                            type="number"
                            dir="ltr"
                            min="0"
                            step="0.01"
                            value={item.edit_actual_price}
                            onChange={(e) => updateReceiveItem(index, "edit_actual_price", Number(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Input
                            type="date"
                            dir="ltr"
                            value={item.edit_expiry_date}
                            onChange={(e) => updateReceiveItem(index, "edit_expiry_date", e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                      )}
                      {!readOnly && (
                        <TableCell>
                          <Input
                            dir="ltr"
                            value={item.edit_batch_number}
                            onChange={(e) => updateReceiveItem(index, "edit_batch_number", e.target.value)}
                            className="h-8 text-sm"
                            placeholder="—"
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {order?.notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">ملاحظات: </span>
                {order.notes}
              </div>
            )}

            {!readOnly && (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => receiveMutation.mutate()}
                  disabled={receiveMutation.isPending}
                >
                  {receiveMutation.isPending ? "جاري الاستلام..." : "تأكيد الاستلام"}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
