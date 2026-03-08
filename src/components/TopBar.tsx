import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

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
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pwa-theme") === "dark" || (!localStorage.getItem("pwa-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("pwa-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <header className="h-14 flex items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="h-9 w-9">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
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
