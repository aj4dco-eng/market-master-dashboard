import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, UserCog, UserX, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  user_roles: {role: string;}[];
};

type FormData = {
  full_name: string;
  email: string;
  password: string;
  role: "admin" | "accountant" | "employee";
  is_active: boolean;
};

const emptyForm: FormData = { full_name: "", email: "", password: "", role: "employee", is_active: true };

const roleLabel: Record<string, string> = { admin: "مدير", accountant: "محاسب", employee: "موظف" };
const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = { admin: "default", accountant: "secondary", employee: "outline" };

export default function UsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, { role: string }[]> = {};
      for (const r of roles ?? []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push({ role: r.role });
      }
      return (profiles ?? []).map(p => ({ ...p, user_roles: roleMap[p.id] ?? [] })) as unknown as UserProfile[];
    }
  });

  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditingUser(u);
    setForm({
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      password: "",
      role: u.user_roles?.[0]?.role as any ?? "employee",
      is_active: u.is_active
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        // Update profile
        const { error: pErr } = await supabase.
        from("profiles").
        update({ full_name: form.full_name, is_active: form.is_active }).
        eq("id", editingUser.id);
        if (pErr) throw pErr;

        // Upsert role
        const { error: rErr } = await supabase.
        from("user_roles").
        upsert({ user_id: editingUser.id, role: form.role } as any, { onConflict: "user_id,role" } as any);
        if (rErr) {
          // If upsert fails, try delete + insert
          await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
          const { error: r2 } = await supabase.from("user_roles").insert({ user_id: editingUser.id, role: form.role });
          if (r2) throw r2;
        }
      } else {
        // Create new user
        if (!form.password) throw new Error("كلمة المرور مطلوبة");
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.full_name } }
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error("فشل إنشاء المستخدم");

        await new Promise((r) => setTimeout(r, 1000));

        await supabase.
        from("profiles").
        update({ full_name: form.full_name, is_active: true }).
        eq("id", authData.user.id);

        // Delete default role then insert desired
        await supabase.from("user_roles").delete().eq("user_id", authData.user.id);
        await supabase.from("user_roles").insert({ user_id: authData.user.id, role: form.role });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDialogOpen(false);
      toast.success(editingUser ? "تم تحديث المستخدم" : "تم إضافة المستخدم");
      logActivity({ actionType: editingUser ? "update" : "create", module: "users", description: editingUser ? `تعديل مستخدم: ${form.full_name}` : `إضافة مستخدم: ${form.email}` });
    },
    onError: (e: any) => toast.error(e.message || "حدث خطأ")
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("profiles").update({ is_active: false }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDeactivateId(null);
      toast.success("تم تعطيل المستخدم");
    },
    onError: () => toast.error("حدث خطأ")
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">إدارة المستخدمين</h1>
            <Badge variant="secondary">{users?.length ?? 0}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/users/activity")}>
              <Activity className="ml-2 h-4 w-4" />سجل الحركات
            </Button>
            <Button onClick={openAdd}><Plus className="ml-2 h-4 w-4" />إضافة مستخدم</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ?
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> :

            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>البريد الإلكتروني</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u) => {
                  const role = u.user_roles?.[0]?.role ?? "employee";
                  return (
                    <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || u.email || "-"}</TableCell>
                        <TableCell dir="ltr">{u.email ?? "-"}</TableCell>
                        <TableCell><Badge variant={roleBadgeVariant[role] ?? "outline"}>{roleLabel[role] ?? role}</Badge></TableCell>
                        <TableCell>
                          {u.is_active ?
                        <Badge className="bg-accent text-accent-foreground">نشط</Badge> :
                        <Badge variant="secondary">معطل</Badge>}
                        </TableCell>
                        <TableCell dir="ltr">{new Date(u.created_at).toLocaleDateString("en-GB")}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><UserCog className="h-4 w-4 ml-1" />تعديل</Button>
                            {u.id !== user?.id && u.is_active &&
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivateId(u.id)}>
                                <UserX className="h-4 w-4 ml-1" />تعطيل
                              </Button>
                          }
                          </div>
                        </TableCell>
                      </TableRow>);

                })}
                  {(!users || users.length === 0) &&
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا يوجد مستخدمون</TableCell></TableRow>
                }
                </TableBody>
              </Table>
            }
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingUser ? "تعديل المستخدم" : "إضافة مستخدم جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الاسم الكامل *</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <Label>البريد الإلكتروني *</Label>
              <Input type="email" dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!!editingUser} />
            </div>
            <div>
              <Label>{editingUser ? "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" : "كلمة المرور *"}</Label>
              <Input type="password" dir="ltr" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="accountant">محاسب</SelectItem>
                  <SelectItem value="employee">موظف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingUser &&
            <div>
                <Label>الحالة</Label>
                <Select value={form.is_active ? "active" : "inactive"} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v === "active" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">معطل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="mx-[13px] px-0">إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.full_name || !form.email || !editingUser && !form.password}>
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={!!deactivateId} onOpenChange={(o) => {if (!o) setDeactivateId(null);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تعطيل المستخدم</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من تعطيل هذا المستخدم؟ لن يتمكن من تسجيل الدخول.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => deactivateId && deactivateMutation.mutate(deactivateId)} className="bg-destructive text-destructive-foreground">تعطيل</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>);

}