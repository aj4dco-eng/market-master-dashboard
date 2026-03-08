import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActivityLog } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Camera, Search } from "lucide-react";

interface OrderItem {
  product_id: string;
  product_name: string;
  barcode: string;
  qty: number;
  purchase_price: number;
  selling_price: number;
}

interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewOrderDialog({ open, onOpenChange }: NewOrderDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [scanning, setScanning] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, company_name, single_order_limit")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, barcode, purchase_price, selling_price")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (open) {
      setSupplierId("");
      setExpectedDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setItems([]);
      setProductSearch("");
    }
  }, [open]);

  const filteredProducts = products.filter(
    (p) =>
      !items.some((i) => i.product_id === p.id) &&
      (productSearch
        ? p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(productSearch.toLowerCase())
        : true)
  );

  const addProduct = (p: typeof products[0]) => {
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        barcode: p.barcode || "",
        qty: 1,
        purchase_price: p.purchase_price,
        selling_price: p.selling_price,
      },
    ]);
    setProductSearch("");
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + item.qty * item.purchase_price, 0);

  const startScanner = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("order-barcode-scanner");
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (text) => {
          const found = products.find((p) => p.barcode === text);
          if (found && !items.some((i) => i.product_id === found.id)) {
            addProduct(found);
            toast({ title: `تمت إضافة: ${found.name}` });
          } else if (!found) {
            toast({ title: "المنتج غير موجود", variant: "destructive" });
          }
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
    } catch {
      setScanning(false);
      toast({ title: "تعذّر فتح الكاميرا", variant: "destructive" });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Generate order number
      const { data: orderNum, error: numErr } = await supabase.rpc("generate_order_number");
      if (numErr) throw numErr;

      const supplier = suppliers.find((s) => s.id === supplierId);
      const singleLimit = supplier?.single_order_limit ?? 0;
      const status = singleLimit > 0 && total > singleLimit ? "awaiting_approval" : "pending";

      const { data: order, error: orderErr } = await supabase
        .from("purchase_orders")
        .insert({
          order_number: orderNum as string,
          supplier_id: supplierId,
          created_by: user?.id || null,
          status,
          expected_date: expectedDate || null,
          notes: notes || null,
          total_amount: total,
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        barcode: item.barcode || null,
        product_name: item.product_name,
        requested_qty: item.qty,
        requested_purchase_price: item.purchase_price,
        selling_price: item.selling_price,
      }));

      const { error: itemsErr } = await supabase.from("purchase_order_items").insert(orderItems);
      if (itemsErr) throw itemsErr;

      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-item-counts"] });
      onOpenChange(false);
      toast({
        title: "تم إنشاء الطلبية",
        description: status === "awaiting_approval" ? "الطلبية تحتاج موافقة المدير (تجاوزت حد الطلبية)" : undefined,
      });
      logActivity({ actionType: "create", module: "orders", description: "إنشاء طلبية شراء جديدة" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>طلبية شراء جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>المورد *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.company_name || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ التوصيل المتوقع</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} dir="ltr" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {/* Add products */}
          <div className="space-y-2">
            <Label>إضافة منتجات</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الباركود..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pr-9"
                />
              </div>
              <Button type="button" variant="outline" size="icon" onClick={startScanner}>
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            {scanning && <div id="order-barcode-scanner" className="w-full rounded-md overflow-hidden border h-48" />}
            {productSearch && filteredProducts.length > 0 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredProducts.slice(0, 10).map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-right px-3 py-2 hover:bg-muted/50 text-sm flex justify-between"
                    onClick={() => addProduct(p)}
                  >
                    <span>{p.name}</span>
                    <span className="text-muted-foreground text-xs" dir="ltr">{p.barcode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items table */}
          {items.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead className="w-24">الكمية</TableHead>
                    <TableHead className="w-32">سعر الشراء (₪)</TableHead>
                    <TableHead className="w-32">سعر البيع (₪)</TableHead>
                    <TableHead className="w-32">المجموع</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.product_id}>
                      <TableCell className="text-sm">{item.product_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          dir="ltr"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateItem(index, "qty", Number(e.target.value) || 1)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          dir="ltr"
                          min="0"
                          step="0.01"
                          value={item.purchase_price}
                          onChange={(e) => updateItem(index, "purchase_price", Number(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          dir="ltr"
                          min="0"
                          step="0.01"
                          value={item.selling_price}
                          onChange={(e) => updateItem(index, "selling_price", Number(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </TableCell>
                      <TableCell dir="ltr" className="text-right font-semibold text-sm">
                        ₪{(item.qty * item.purchase_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(index)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center p-3 border-t bg-muted/30">
                <span className="font-semibold">الإجمالي</span>
                <span className="font-bold text-lg" dir="ltr">
                  ₪{total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              disabled={!supplierId || items.length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الطلبية"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
