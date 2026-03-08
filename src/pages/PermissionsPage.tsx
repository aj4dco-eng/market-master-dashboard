import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Users, Save } from "lucide-react";
import { MODULE_LABELS, ACTION_LABELS, MODULE_ACTIONS, type PermissionModule, type PermissionAction } from "@/hooks/usePermissions";

type RolePerm = { id: string; role: string; module: string; action: string; allowed: boolean };
type UserOverride = { id: string; user_id: string; module: string; action: string; allowed: boolean };
type UserProfile = { id: string; full_name: string | null; email: string | null; user_roles: { role: string }[] };

const ROLES = [
  { value: "admin", label: "مدير" },
  { value: "accountant", label: "محاسب" },
  { value: "employee", label: "موظف" },
];

const MODULES = Object.keys(MODULE_ACTIONS) as PermissionModule[];

export default function PermissionsPage() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState("admin");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [localRolePerms, setLocalRolePerms] = useState<Record<string, boolean>>({});
  const [localUserOverrides, setLocalUserOverrides] = useState<Record<string, boolean | null>>({});
  const [dirty, setDirty] = useState(false);

  // Fetch role permissions
  const { data: rolePerms, isLoading: loadingRole } = useQuery({
    queryKey: ["all-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions" as any).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as RolePerm[];
    },
  });

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ["admin-users-for-perms"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from("profiles").select("*").order("created_at");
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, { role: string }[]> = {};
      for (const r of roles ?? []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push({ role: r.role });
      }
      return (profiles ?? []).map(p => ({ ...p, user_roles: roleMap[p.id] ?? [] })) as unknown as UserProfile[];
    },
  });

  // Fetch user overrides
  const { data: userOverrides, isLoading: loadingOverrides } = useQuery({
    queryKey: ["user-overrides", selectedUserId],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const { data, error } = await supabase.from("user_permission_overrides" as any).select("*").eq("user_id", selectedUserId);
      if (error) throw error;
      return (data ?? []) as unknown as UserOverride[];
    },
    enabled: !!selectedUserId,
  });

  // Build role permission map for selected role
  const getRolePermValue = (module: string, action: string): boolean => {
    const key = `${selectedRole}:${module}:${action}`;
    if (key in localRolePerms) return localRolePerms[key];
    const found = rolePerms?.find(p => p.role === selectedRole && p.module === module && p.action === action);
    return found?.allowed ?? false;
  };

  const toggleRolePerm = (module: string, action: string) => {
    const key = `${selectedRole}:${module}:${action}`;
    const current = getRolePermValue(module, action);
    setLocalRolePerms(prev => ({ ...prev, [key]: !current }));
    setDirty(true);
  };

  // User override: null = use role default, true/false = override
  const getUserOverrideValue = (module: string, action: string): boolean | null => {
    const key = `${selectedUserId}:${module}:${action}`;
    if (key in localUserOverrides) return localUserOverrides[key];
    const found = userOverrides?.find(o => o.module === module && o.action === action);
    return found ? found.allowed : null;
  };

  const getUserEffectiveValue = (module: string, action: string): boolean => {
    const override = getUserOverrideValue(module, action);
    if (override !== null) return override;
    // Fall back to role default
    const userRole = users?.find(u => u.id === selectedUserId)?.user_roles?.[0]?.role ?? "employee";
    const found = rolePerms?.find(p => p.role === userRole && p.module === module && p.action === action);
    return found?.allowed ?? false;
  };

  const cycleUserOverride = (module: string, action: string) => {
    const key = `${selectedUserId}:${module}:${action}`;
    const current = getUserOverrideValue(module, action);
    // null -> true -> false -> null
    let next: boolean | null;
    if (current === null) next = true;
    else if (current === true) next = false;
    else next = null;
    setLocalUserOverrides(prev => ({ ...prev, [key]: next }));
    setDirty(true);
  };

  // Save role permissions
  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      for (const [key, allowed] of Object.entries(localRolePerms)) {
        const [role, module, action] = key.split(":");
        const existing = rolePerms?.find(p => p.role === role && p.module === module && p.action === action);
        if (existing) {
          await supabase.from("role_permissions" as any).update({ allowed } as any).eq("id", existing.id);
        } else {
          await supabase.from("role_permissions" as any).insert({ role, module, action, allowed } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      setLocalRolePerms({});
      setDirty(false);
      toast.success("تم حفظ صلاحيات الدور");
    },
    onError: () => toast.error("حدث خطأ أثناء الحفظ"),
  });

  // Save user overrides
  const saveUserMutation = useMutation({
    mutationFn: async () => {
      for (const [key, allowed] of Object.entries(localUserOverrides)) {
        const [userId, module, action] = key.split(":");
        if (allowed === null) {
          // Remove override
          await supabase.from("user_permission_overrides" as any).delete().eq("user_id", userId).eq("module", module).eq("action", action);
        } else {
          const existing = userOverrides?.find(o => o.module === module && o.action === action);
          if (existing) {
            await supabase.from("user_permission_overrides" as any).update({ allowed } as any).eq("id", existing.id);
          } else {
            await supabase.from("user_permission_overrides" as any).insert({ user_id: userId, module, action, allowed } as any);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-overrides", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["user-permission-overrides"] });
      setLocalUserOverrides({});
      setDirty(false);
      toast.success("تم حفظ صلاحيات المستخدم");
    },
    onError: () => toast.error("حدث خطأ أثناء الحفظ"),
  });

  const renderPermissionGrid = (mode: "role" | "user") => {
    const allActions = Array.from(new Set(MODULES.flatMap(m => MODULE_ACTIONS[m])));

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky right-0 bg-card z-10 min-w-[140px]">الوحدة</TableHead>
              {allActions.map(a => (
                <TableHead key={a} className="text-center min-w-[80px]">{ACTION_LABELS[a]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULES.map(module => {
              const moduleActions = MODULE_ACTIONS[module];
              return (
                <TableRow key={module}>
                  <TableCell className="sticky right-0 bg-card z-10 font-medium">
                    {MODULE_LABELS[module]}
                  </TableCell>
                  {allActions.map(action => {
                    const isApplicable = moduleActions.includes(action);
                    if (!isApplicable) return <TableCell key={action} className="text-center text-muted-foreground">—</TableCell>;

                    if (mode === "role") {
                      const checked = getRolePermValue(module, action);
                      return (
                        <TableCell key={action} className="text-center">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleRolePerm(module, action)}
                          />
                        </TableCell>
                      );
                    } else {
                      const override = getUserOverrideValue(module, action);
                      const effective = getUserEffectiveValue(module, action);
                      return (
                        <TableCell key={action} className="text-center">
                          <button
                            onClick={() => cycleUserOverride(module, action)}
                            className={`w-7 h-7 rounded-md border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                              override === null
                                ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
                                : override
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-destructive bg-destructive/10 text-destructive"
                            }`}
                            title={
                              override === null
                                ? `افتراضي الدور: ${effective ? "مسموح" : "ممنوع"}`
                                : override
                                ? "مسموح (تخصيص)"
                                : "ممنوع (تخصيص)"
                            }
                          >
                            {override === null ? (effective ? "✓" : "✗") : override ? "✓" : "✗"}
                          </button>
                        </TableCell>
                      );
                    }
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">إدارة الصلاحيات</h1>
        </div>

        <Tabs defaultValue="roles" onValueChange={() => { setDirty(false); setLocalRolePerms({}); setLocalUserOverrides({}); }}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="roles" className="gap-2"><Shield className="h-4 w-4" />صلاحيات الأدوار</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />صلاحيات المستخدمين</TabsTrigger>
          </TabsList>

          {/* Role Permissions Tab */}
          <TabsContent value="roles">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg">صلاحيات الدور الافتراضية</CardTitle>
                <div className="flex items-center gap-3">
                  <Select value={selectedRole} onValueChange={v => { setSelectedRole(v); setLocalRolePerms({}); setDirty(false); }}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {dirty && (
                    <Button size="sm" onClick={() => saveRoleMutation.mutate()} disabled={saveRoleMutation.isPending}>
                      <Save className="h-4 w-4 ml-1" />
                      {saveRoleMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRole ? (
                  <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : renderPermissionGrid("role")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Permissions Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg">صلاحيات مخصصة لكل مستخدم</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    اضغط على الخانة للتبديل: <span className="text-muted-foreground">رمادي = افتراضي الدور</span> | <span className="text-primary">أزرق = مسموح</span> | <span className="text-destructive">أحمر = ممنوع</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select value={selectedUserId} onValueChange={v => { setSelectedUserId(v); setLocalUserOverrides({}); setDirty(false); }}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="اختر مستخدم..." /></SelectTrigger>
                    <SelectContent>
                      {users?.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name || u.email} 
                          <Badge variant="outline" className="mr-2 text-[10px]">
                            {ROLES.find(r => r.value === u.user_roles?.[0]?.role)?.label ?? "موظف"}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dirty && selectedUserId && (
                    <Button size="sm" onClick={() => saveUserMutation.mutate()} disabled={saveUserMutation.isPending}>
                      <Save className="h-4 w-4 ml-1" />
                      {saveUserMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedUserId ? (
                  <div className="p-8 text-center text-muted-foreground">اختر مستخدماً لعرض وتعديل صلاحياته</div>
                ) : loadingOverrides ? (
                  <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : renderPermissionGrid("user")}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
