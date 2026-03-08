import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActivityLog } from "@/hooks/useActivityLog";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import type { Supplier } from "@/pages/SuppliersPage";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
}

interface SupplierFormData {
  name: string;
  company_name: string;
  tax_number: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  payment_terms: string;
  credit_limit: string;
  credit_days: string;
  single_order_limit: string;
  monthly_limit: string;
  rating: string;
  notes: string;
  contact1_name: string;
  contact1_title: string;
  contact1_phone: string;
  contact1_whatsapp: string;
  contact1_email: string;
  contact2_name: string;
  contact2_title: string;
  contact2_phone: string;
  contact2_whatsapp: string;
  contact2_email: string;
}

export function SupplierDialog({ open, onOpenChange, supplier }: SupplierDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!supplier;

  const { register, handleSubmit, reset, setValue, watch } = useForm<SupplierFormData>({
    defaultValues: {
      name: "", company_name: "", tax_number: "", phone: "", email: "",
      address: "", city: "", payment_terms: "نقد", credit_limit: "0",
      credit_days: "0", single_order_limit: "0", monthly_limit: "0",
      rating: "", notes: "",
      contact1_name: "", contact1_title: "", contact1_phone: "", contact1_whatsapp: "", contact1_email: "",
      contact2_name: "", contact2_title: "", contact2_phone: "", contact2_whatsapp: "", contact2_email: "",
    },
  });

  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name || "",
        company_name: supplier.company_name || "",
        tax_number: supplier.tax_number || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        city: supplier.city || "",
        payment_terms: supplier.payment_terms || "نقد",
        credit_limit: String(supplier.credit_limit ?? 0),
        credit_days: String(supplier.credit_days ?? 0),
        single_order_limit: String(supplier.single_order_limit ?? 0),
        monthly_limit: String(supplier.monthly_limit ?? 0),
        rating: supplier.rating ? String(supplier.rating) : "",
        notes: supplier.notes || "",
        contact1_name: supplier.contact1_name || "",
        contact1_title: supplier.contact1_title || "",
        contact1_phone: supplier.contact1_phone || "",
        contact1_whatsapp: supplier.contact1_whatsapp || "",
        contact1_email: supplier.contact1_email || "",
        contact2_name: supplier.contact2_name || "",
        contact2_title: supplier.contact2_title || "",
        contact2_phone: supplier.contact2_phone || "",
        contact2_whatsapp: supplier.contact2_whatsapp || "",
        contact2_email: supplier.contact2_email || "",
      });
    } else {
      reset({
        name: "", company_name: "", tax_number: "", phone: "", email: "",
        address: "", city: "", payment_terms: "نقد", credit_limit: "0",
        credit_days: "0", single_order_limit: "0", monthly_limit: "0",
        rating: "", notes: "",
        contact1_name: "", contact1_title: "", contact1_phone: "", contact1_whatsapp: "", contact1_email: "",
        contact2_name: "", contact2_title: "", contact2_phone: "", contact2_whatsapp: "", contact2_email: "",
      });
    }
  }, [supplier, reset]);

  const mutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const payload = {
        name: data.name,
        company_name: data.company_name || null,
        tax_number: data.tax_number || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        payment_terms: data.payment_terms || null,
        credit_limit: parseFloat(data.credit_limit) || 0,
        credit_days: parseInt(data.credit_days) || 0,
        single_order_limit: parseFloat(data.single_order_limit) || 0,
        monthly_limit: parseFloat(data.monthly_limit) || 0,
        rating: data.rating ? parseInt(data.rating) : null,
        notes: data.notes || null,
        contact1_name: data.contact1_name || null,
        contact1_title: data.contact1_title || null,
        contact1_phone: data.contact1_phone || null,
        contact1_whatsapp: data.contact1_whatsapp || null,
        contact1_email: data.contact1_email || null,
        contact2_name: data.contact2_name || null,
        contact2_title: data.contact2_title || null,
        contact2_phone: data.contact2_phone || null,
        contact2_whatsapp: data.contact2_whatsapp || null,
        contact2_email: data.contact2_email || null,
      };

      if (isEdit && supplier) {
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", supplier.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: isEdit ? "تم تحديث المورد بنجاح" : "تم إضافة المورد بنجاح" });
      onOpenChange(false);
      logActivity({ actionType: isEdit ? "update" : "create", module: "suppliers", description: isEdit ? "تعديل مورد" : "إضافة مورد جديد" });
    },
    onError: (error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SupplierFormData) => mutation.mutate(data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل مورد" : "إضافة مورد جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Tabs defaultValue="company" dir="rtl">
            <TabsList className="w-full">
              <TabsTrigger value="company" className="flex-1">بيانات الشركة</TabsTrigger>
              <TabsTrigger value="contacts" className="flex-1">جهات الاتصال</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المورد *</Label>
                  <Input {...register("name", { required: true })} placeholder="اسم المورد" />
                </div>
                <div className="space-y-2">
                  <Label>اسم الشركة</Label>
                  <Input {...register("company_name")} placeholder="اسم الشركة" />
                </div>
                <div className="space-y-2">
                  <Label>الرقم الضريبي</Label>
                  <Input {...register("tax_number")} placeholder="الرقم الضريبي" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input {...register("phone")} placeholder="رقم الهاتف" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input {...register("email")} type="email" placeholder="email@example.com" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>المدينة</Label>
                  <Input {...register("city")} placeholder="المدينة" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>العنوان</Label>
                  <Input {...register("address")} placeholder="العنوان الكامل" />
                </div>
                <div className="space-y-2">
                  <Label>شروط الدفع</Label>
                  <Select
                    value={watch("payment_terms")}
                    onValueChange={(v) => setValue("payment_terms", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="نقد">نقد</SelectItem>
                      <SelectItem value="آجل">آجل</SelectItem>
                      <SelectItem value="شيك">شيك</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>حد الائتمان (₪)</Label>
                  <Input {...register("credit_limit")} type="number" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>أيام الائتمان</Label>
                  <Input {...register("credit_days")} type="number" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>حد الطلبية الواحدة (₪)</Label>
                  <Input {...register("single_order_limit")} type="number" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>الحد الشهري (₪)</Label>
                  <Input {...register("monthly_limit")} type="number" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label>التقييم (1-5)</Label>
                  <Input {...register("rating")} type="number" min="1" max="5" dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات</Label>
                <Textarea {...register("notes")} placeholder="ملاحظات إضافية..." />
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="space-y-6 mt-4">
              {/* Contact 1 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base border-b pb-2">جهة الاتصال الأولى</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input {...register("contact1_name")} placeholder="الاسم" />
                  </div>
                  <div className="space-y-2">
                    <Label>المسمى الوظيفي</Label>
                    <Input {...register("contact1_title")} placeholder="المسمى الوظيفي" />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input {...register("contact1_phone")} placeholder="رقم الهاتف" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>واتساب</Label>
                    <Input {...register("contact1_whatsapp")} placeholder="رقم الواتساب" dir="ltr" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input {...register("contact1_email")} type="email" placeholder="email@example.com" dir="ltr" />
                  </div>
                </div>
              </div>

              {/* Contact 2 */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base border-b pb-2">جهة الاتصال الثانية</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input {...register("contact2_name")} placeholder="الاسم" />
                  </div>
                  <div className="space-y-2">
                    <Label>المسمى الوظيفي</Label>
                    <Input {...register("contact2_title")} placeholder="المسمى الوظيفي" />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input {...register("contact2_phone")} placeholder="رقم الهاتف" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>واتساب</Label>
                    <Input {...register("contact2_whatsapp")} placeholder="رقم الواتساب" dir="ltr" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input {...register("contact2_email")} type="email" placeholder="email@example.com" dir="ltr" />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "جاري الحفظ..." : isEdit ? "تحديث" : "إضافة"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
