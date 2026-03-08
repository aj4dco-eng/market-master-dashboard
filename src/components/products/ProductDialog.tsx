import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActivityLog } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Plus, Package } from "lucide-react";
import type { Product, Category } from "@/pages/ProductsPage";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: Category[];
  suppliers: { id: string; name: string; company_name: string | null }[];
}

const UNITS = ["قطعة", "كرتون", "كيلو", "لتر"];

export function ProductDialog({ open, onOpenChange, product, categories, suppliers }: ProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: "",
    barcode: "",
    category_id: "",
    supplier_id: "",
    unit: "قطعة",
    purchase_price: "0",
    selling_price: "0",
    min_stock_alert: "0",
    is_active: true,
    newCategoryName: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);

  useEffect(() => {
    if (open) {
      if (product) {
        setForm({
          name: product.name,
          barcode: product.barcode || "",
          category_id: product.category_id || "",
          supplier_id: product.supplier_id || "",
          unit: product.unit || "قطعة",
          purchase_price: String(product.purchase_price),
          selling_price: String(product.selling_price),
          min_stock_alert: String(product.min_stock_alert),
          is_active: product.is_active,
          newCategoryName: "",
        });
        if (product.image_url) {
          const url = product.image_url.startsWith("http")
            ? product.image_url
            : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${product.image_url}`;
          setImagePreview(url);
        } else {
          setImagePreview(null);
        }
      } else {
        setForm({
          name: "", barcode: "", category_id: "", supplier_id: "", unit: "قطعة",
          purchase_price: "0", selling_price: "0", min_stock_alert: "0", is_active: true, newCategoryName: "",
        });
        setImagePreview(null);
      }
      setImageFile(null);
      setShowNewCategory(false);
    }
  }, [open, product]);

  // Cleanup scanner on unmount/close
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  const startScanner = async () => {
    if (scanning) {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setScanning(false);
      return;
    }
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("barcode-scanner");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 100 } },
        (decodedText) => {
          setForm((prev) => ({ ...prev, barcode: decodedText }));
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          setScanning(false);
          toast({ title: "تم مسح الباركود بنجاح" });
        },
        () => {}
      );
    } catch {
      setScanning(false);
      toast({ title: "تعذّر فتح الكاميرا", variant: "destructive" });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return product?.image_url || null;
    const ext = imageFile.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, imageFile, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    return path;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let categoryId = form.category_id;

      // Create new category if needed
      if (showNewCategory && form.newCategoryName.trim()) {
        const { data, error } = await supabase
          .from("categories")
          .insert({ name: form.newCategoryName.trim() })
          .select("id")
          .single();
        if (error) throw error;
        categoryId = data.id;
      }

      const imageUrl = await uploadImage();

      const payload = {
        name: form.name,
        barcode: form.barcode || null,
        category_id: categoryId || null,
        supplier_id: form.supplier_id || null,
        unit: form.unit,
        purchase_price: parseFloat(form.purchase_price) || 0,
        selling_price: parseFloat(form.selling_price) || 0,
        min_stock_alert: parseFloat(form.min_stock_alert) || 0,
        is_active: form.is_active,
        image_url: imageUrl,
      };

      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onOpenChange(false);
      toast({ title: product ? "تم تحديث المنتج" : "تم إضافة المنتج" });
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const update = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">بيانات المنتج</TabsTrigger>
            <TabsTrigger value="image" className="flex-1">الصورة</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>اسم المنتج *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>الباركود</Label>
              <div className="flex gap-2">
                <Input value={form.barcode} onChange={(e) => update("barcode", e.target.value)} dir="ltr" className="flex-1" />
                <Button type="button" variant="outline" size="icon" onClick={startScanner}>
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              {scanning && <div id="barcode-scanner" className="w-full rounded-md overflow-hidden border" ref={scannerContainerRef} />}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الصنف</Label>
                {!showNewCategory ? (
                  <div className="flex gap-1">
                    <Select value={form.category_id} onValueChange={(v) => update("category_id", v)}>
                      <SelectTrigger><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNewCategory(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Input placeholder="اسم الصنف الجديد" value={form.newCategoryName} onChange={(e) => update("newCategoryName", e.target.value)} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewCategory(false)}>إلغاء</Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>المورد</Label>
                <Select value={form.supplier_id} onValueChange={(v) => update("supplier_id", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.company_name || s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>الوحدة</Label>
              <Select value={form.unit} onValueChange={(v) => update("unit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>سعر الشراء (₪)</Label>
                <Input type="number" dir="ltr" value={form.purchase_price} onChange={(e) => update("purchase_price", e.target.value)} min="0" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label>سعر البيع (₪)</Label>
                <Input type="number" dir="ltr" value={form.selling_price} onChange={(e) => update("selling_price", e.target.value)} min="0" step="0.01" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الحد الأدنى للتنبيه</Label>
              <Input type="number" dir="ltr" value={form.min_stock_alert} onChange={(e) => update("min_stock_alert", e.target.value)} min="0" />
            </div>

            <div className="flex items-center justify-between">
              <Label>نشط</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
            </div>
          </TabsContent>

          <TabsContent value="image" className="mt-4">
            <div className="space-y-4">
              <div
                className="h-48 rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:border-primary/40 transition-colors overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-contain" />
                ) : (
                  <>
                    <Package className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">اضغط لاختيار صورة</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="ml-2 h-4 w-4" />
                  رفع صورة
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.capture = "environment";
                    input.onchange = (e: any) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    };
                    input.click();
                  }}
                >
                  <Camera className="ml-2 h-4 w-4" />
                  التقاط صورة
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 mt-4">
          <Button className="flex-1" onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
            {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
