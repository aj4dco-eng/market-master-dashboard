import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const { role } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <Tabs defaultValue="store" dir="rtl">
          <TabsList className={`grid w-full ${role === "admin" ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="store">إعدادات المتجر</TabsTrigger>
            <TabsTrigger value="account">إعدادات الحساب</TabsTrigger>
            {role === "admin" && <TabsTrigger value="danger" className="text-destructive">منطقة الخطر</TabsTrigger>}
          </TabsList>
          <TabsContent value="store"><StoreSettings /></TabsContent>
          <TabsContent value="account"><AccountSettings /></TabsContent>
          {role === "admin" && <TabsContent value="danger"><DangerZone /></TabsContent>}
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

function DangerZone() {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-demo-data");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setConfirmText("");
      toast.success("تم حذف جميع البيانات التجريبية بنجاح");
    },
    onError: (e: any) => toast.error(e.message || "حدث خطأ أثناء الحذف"),
  });

  return (
    <Card className="mt-4 border-destructive/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">حذف البيانات التجريبية</CardTitle>
        </div>
        <CardDescription>
          سيتم حذف جميع البيانات (الموردين، المنتجات، الأصناف، الطلبيات، المبيعات، الفواتير، المصروفات، الجرد، سجل النشاط) مع الإبقاء على المستخدمين وإعدادات النظام والصلاحيات.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="ml-2 h-4 w-4" />
              حذف جميع البيانات التجريبية
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد تماماً؟</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">هذا الإجراء <strong>لا يمكن التراجع عنه</strong>. سيتم حذف جميع البيانات التالية نهائياً:</span>
                <span className="block text-sm">الموردين • المنتجات • الأصناف • الطلبيات • المبيعات • الفواتير • المصروفات • الجرد • سجل النشاط</span>
                <span className="block mt-2">اكتب <strong>حذف</strong> للتأكيد:</span>
              </AlertDialogDescription>
              <Input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="اكتب: حذف"
                className="mt-2"
              />
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText("")}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== "حذف" || deleteMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  deleteMutation.mutate();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف نهائي"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
