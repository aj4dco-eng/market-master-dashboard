import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermissionModule = 
  | "suppliers" | "products" | "orders" | "inventory" 
  | "sales" | "pos" | "invoices" | "expenses" 
  | "reports" | "users" | "settings" | "permissions";

export type PermissionAction = 
  | "view" | "create" | "edit" | "delete" 
  | "edit_prices" | "cancel" | "use" | "export";

export const MODULE_LABELS: Record<PermissionModule, string> = {
  suppliers: "الموردون",
  products: "المنتجات",
  orders: "الطلبيات",
  inventory: "الجرد",
  sales: "المبيعات",
  pos: "نقطة البيع",
  invoices: "الفواتير",
  expenses: "المصروفات",
  reports: "التقارير",
  users: "المستخدمون",
  settings: "الإعدادات",
  permissions: "الصلاحيات",
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "عرض",
  create: "إضافة",
  edit: "تعديل",
  delete: "حذف",
  edit_prices: "تعديل الأسعار",
  cancel: "إلغاء",
  use: "استخدام",
  export: "تصدير",
};

export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  suppliers: ["view", "create", "edit", "delete"],
  products: ["view", "create", "edit", "delete", "edit_prices"],
  orders: ["view", "create", "edit", "delete"],
  inventory: ["view", "create", "edit"],
  sales: ["view", "cancel"],
  pos: ["view", "use"],
  invoices: ["view", "create", "edit", "delete"],
  expenses: ["view", "create", "edit", "delete"],
  reports: ["view", "export"],
  users: ["view", "create", "edit", "delete"],
  settings: ["view", "edit"],
  permissions: ["view", "edit"],
};

type PermissionMap = Record<string, boolean>;

export function usePermissions() {
  const { user, role } = useAuth();

  const { data: rolePerms } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("role_permissions" as any)
        .select("*");
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const { data: userOverrides } = useQuery({
    queryKey: ["user-permission-overrides", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_permission_overrides" as any)
        .select("*")
        .eq("user_id", user!.id);
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  const permMap: PermissionMap = {};
  
  // Build from role defaults
  if (rolePerms && role) {
    for (const p of rolePerms) {
      if (p.role === role) {
        permMap[`${p.module}:${p.action}`] = p.allowed;
      }
    }
  }

  // Apply user overrides
  if (userOverrides) {
    for (const o of userOverrides) {
      permMap[`${o.module}:${o.action}`] = o.allowed;
    }
  }

  const hasPermission = (module: PermissionModule, action: PermissionAction): boolean => {
    // Admin role always has full access as fallback
    if (role === "admin" && permMap[`${module}:${action}`] === undefined) return true;
    return permMap[`${module}:${action}`] ?? false;
  };

  const canView = (module: PermissionModule) => hasPermission(module, "view");
  const canCreate = (module: PermissionModule) => hasPermission(module, "create");
  const canEdit = (module: PermissionModule) => hasPermission(module, "edit");
  const canDelete = (module: PermissionModule) => hasPermission(module, "delete");

  return { hasPermission, canView, canCreate, canEdit, canDelete, permMap };
}
