import {
  LayoutDashboard,
  Users,
  Settings,
  Package,
  ShoppingCart,
  FileText,
  Calculator,
  LogOut,
  Store,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, AppRole } from "@/contexts/AuthContext";
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

interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const menuItems: MenuItem[] = [
  { title: "لوحة التحكم", url: "/dashboard/admin", icon: LayoutDashboard, roles: ["admin"] },
  { title: "لوحة التحكم", url: "/dashboard/accountant", icon: LayoutDashboard, roles: ["accountant"] },
  { title: "لوحة التحكم", url: "/dashboard/employee", icon: LayoutDashboard, roles: ["employee"] },
  { title: "المستخدمون", url: "/users", icon: Users, roles: ["admin"] },
  { title: "المنتجات", url: "/products", icon: Package, roles: ["admin", "employee"] },
  { title: "المبيعات", url: "/sales", icon: ShoppingCart, roles: ["admin", "accountant", "employee"] },
  { title: "الفواتير", url: "/invoices", icon: FileText, roles: ["admin", "accountant"] },
  { title: "المحاسبة", url: "/accounting", icon: Calculator, roles: ["admin", "accountant"] },
  { title: "الإعدادات", url: "/settings", icon: Settings, roles: ["admin"] },
];

export function AppSidebar() {
  const { role, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const filteredItems = menuItems.filter((item) => role && item.roles.includes(role));

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
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
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
