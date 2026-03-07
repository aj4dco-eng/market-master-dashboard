import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";

const roleLabels: Record<string, string> = {
  admin: "مدير",
  accountant: "محاسب",
  employee: "موظف",
};

const roleVariants: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  accountant: "secondary",
  employee: "outline",
};

export function TopBar() {
  const { profile, role } = useAuth();

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        {role && (
          <Badge variant={roleVariants[role] ?? "outline"}>
            {roleLabels[role] ?? role}
          </Badge>
        )}
        <span className="text-sm font-medium text-foreground">
          {profile?.full_name || profile?.email || "مستخدم"}
        </span>
      </div>
    </header>
  );
}
