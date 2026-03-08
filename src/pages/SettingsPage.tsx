import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, Plus, Pencil, Trash2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <Tabs defaultValue="store" dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="store">إعدادات المتجر</TabsTrigger>
            <TabsTrigger value="account">إعدادات الحساب</TabsTrigger>
          </TabsList>
          <TabsContent value="store"><StoreSettings /></TabsContent>
          <TabsContent value="account"><AccountSettings /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

const STORE_FIELDS = [
  { key: "store_name", label: "اسم المتجر", type: "text", dir: "rtl" },
  { key: "store_address", label: "عنوان المتجر", type: "text", dir: "rtl" },
  { key: "store_phone", label: "رقم الهاتف", type: "text", dir: "ltr" },
  { key: "store_email", label: "البريد الإلكتروني", type: "email", dir: "ltr" },
  { key: "currency_symbol", label: "رمز العملة", type: "text", dir: "ltr" },
  { key: "tax_rate", label: "نسبة الضريبة %", type: "number", dir: "ltr" },
  { key: "low_stock_default", label: "الحد الأدنى الافتراضي للمخزون", type: "number", dir: "ltr" },
];

function StoreSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*");
      return Object.fromEntries((data ?? []).map(s => [s.key, s.value ?? ""]));
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(form)) {
        await supabase.from("system_settings").upsert({ key, value: String(value) } as any, { onConflict: "key" } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("تم حفظ الإعدادات");
    },
    onError: () => toast.error("حدث خطأ أثناء الحفظ"),
  });

  if (isLoading) return <div className="space-y-4 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-4">
        {STORE_FIELDS.map(f => (
          <div key={f.key}>
            <Label>{f.label}</Label>
            <Input
              type={f.type}
              dir={f.dir as any}
              value={form[f.key] ?? ""}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          <Save className="ml-2 h-4 w-4" />{saveMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? "");
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("غير مسجل الدخول");
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
      if (newPassword) {
        if (newPassword !== confirmPassword) throw new Error("كلمة المرور غير متطابقة");
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      setNewPassword("");
      setConfirmPassword("");
      toast.success("تم تحديث الحساب");
    },
    onError: (e: any) => toast.error(e.message || "حدث خطأ"),
  });

  return (
    <Card className="mt-4">
      <CardContent className="pt-6 space-y-4">
        <div>
          <Label>الاسم الكامل</Label>
          <Input value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>كلمة المرور الجديدة</Label>
          <Input type="password" dir="ltr" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="اتركها فارغة لعدم التغيير" />
        </div>
        <div>
          <Label>تأكيد كلمة المرور</Label>
          <Input type="password" dir="ltr" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          <Save className="ml-2 h-4 w-4" />{saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CategoriesSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["settings-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*, products(count)").order("name");
      return data ?? [];
    },
  });

  const openAdd = () => { setEditingCat(null); setName(""); setDescription(""); setDialogOpen(true); };
  const openEdit = (c: any) => { setEditingCat(c); setName(c.name); setDescription(c.description ?? ""); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCat) {
        const { error } = await supabase.from("categories").update({ name, description }).eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert({ name, description });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-categories"] });
      setDialogOpen(false);
      toast.success(editingCat ? "تم تحديث الصنف" : "تم إضافة الصنف");
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-categories"] });
      setDeleteId(null);
      toast.success("تم حذف الصنف");
    },
    onError: () => toast.error("لا يمكن حذف الصنف - قد يكون مرتبطاً بمنتجات"),
  });

  const catToDelete = categories?.find(c => c.id === deleteId);
  const productCount = (catToDelete as any)?.products?.[0]?.count ?? 0;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button onClick={openAdd}><Plus className="ml-2 h-4 w-4" />إضافة صنف</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>عدد المنتجات</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description ?? "-"}</TableCell>
                    <TableCell dir="ltr">{c.products?.[0]?.count ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!categories || categories.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">لا توجد أصناف</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? "تعديل الصنف" : "إضافة صنف جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>الاسم *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div><Label>الوصف</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !name.trim()}>
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
            <AlertDialogDescription>
              {productCount > 0
                ? `لا يمكن حذف هذا الصنف لأنه مرتبط بـ ${productCount} منتج.`
                : "هل أنت متأكد من حذف هذا الصنف؟"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            {productCount === 0 && (
              <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
