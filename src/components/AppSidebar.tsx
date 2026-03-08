import {
  LayoutDashboard,
  Users,
  Settings,
  Package,
  ShoppingCart,
  FileText,
  Receipt,
  ReceiptText,
  LogOut,
  Store,
  Truck,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Shield,
  Upload,
  Tags,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { usePermissions, type PermissionModule } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  permModule?: PermissionModule;
  badge?: string | number;
}

export function AppSidebar() {
  const { role, signOut } = useAuth();
  const { canView } = usePermissions();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const { data: supplierCount } = useQuery({
    queryKey: ["suppliers-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const menuItems: MenuItem[] = [
    { title: "لوحة التحكم", url: "/dashboard/admin", icon: LayoutDashboard, roles: ["admin"] },
    { title: "لوحة التحكم", url: "/dashboard/accountant", icon: LayoutDashboard, roles: ["accountant"] },
    { title: "لوحة التحكم", url: "/dashboard/employee", icon: LayoutDashboard, roles: ["employee"] },
    { title: "المستخدمون", url: "/users", icon: Users, roles: ["admin"], permModule: "users" },
    { title: "الموردون", url: "/suppliers", icon: Truck, roles: ["admin", "accountant", "employee"], permModule: "suppliers", badge: supplierCount },
    { title: "المنتجات", url: "/products", icon: Package, roles: ["admin", "employee", "accountant"], permModule: "products" },
    { title: "الأصناف", url: "/categories", icon: Tags, roles: ["admin", "employee", "accountant"], permModule: "categories" },
    { title: "الطلبيات", url: "/orders", icon: ClipboardList, roles: ["admin", "accountant", "employee"], permModule: "orders" },
    { title: "الجرد", url: "/inventory", icon: ClipboardCheck, roles: ["admin", "accountant", "employee"], permModule: "inventory" },
    { title: "التقارير", url: "/reports", icon: BarChart3, roles: ["admin", "accountant"], permModule: "reports" },
    { title: "نقطة البيع", url: "/pos", icon: ShoppingCart, roles: ["admin", "employee"], permModule: "pos" },
    { title: "المبيعات", url: "/sales", icon: ReceiptText, roles: ["admin", "accountant", "employee"], permModule: "sales" },
    { title: "الفواتير", url: "/invoices", icon: FileText, roles: ["admin", "accountant"], permModule: "invoices" },
    { title: "المصروفات", url: "/expenses", icon: Receipt, roles: ["admin", "accountant"], permModule: "expenses" },
    { title: "استيراد البيانات", url: "/import", icon: Upload, roles: ["admin"], permModule: "import" },
    { title: "الصلاحيات", url: "/permissions", icon: Shield, roles: ["admin"], permModule: "permissions" },
    { title: "الإعدادات", url: "/settings", icon: Settings, roles: ["admin"], permModule: "settings" },
  ];

  const filteredItems = menuItems.filter((item) => {
    if (!role || !item.roles.includes(role)) return false;
    if (item.permModule && !canView(item.permModule)) return false;
    return true;
  });

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="gap-2 text-sidebar-foreground/70">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-sidebar-primary" />
                <span className="font-bold text-base">السوبرماركت</span>
              </div>
            )}
            {collapsed && <Store className="h-5 w-5 text-sidebar-primary" />}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="ml-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {item.title}
                          {item.badge != null && Number(item.badge) > 0 && (
                            <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0 h-5 min-w-[20px] justify-center">
                              {item.badge.toLocaleString("en-US")}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="space-y-2">
        {!collapsed && (
          <div className="px-3 py-1">
            <Badge variant="outline" className="text-[10px] text-sidebar-foreground/50 border-sidebar-border">
              الإصدار 1.0.0
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-sidebar-accent/50"
          onClick={signOut}
        >
          <LogOut className="ml-2 h-4 w-4" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
