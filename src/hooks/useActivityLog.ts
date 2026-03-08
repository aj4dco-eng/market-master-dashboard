import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

type LogParams = {
  actionType: string;
  module: string;
  description: string;
  details?: Record<string, any>;
};

export function useActivityLog() {
  const { user } = useAuth();

  const logActivity = useCallback(
    async ({ actionType, module, description, details }: LogParams) => {
      if (!user) return;
      try {
        await supabase.from("activity_logs" as any).insert({
          user_id: user.id,
          action_type: actionType,
          module,
          description,
          details: details ?? {},
        } as any);
      } catch (e) {
        console.error("Failed to log activity:", e);
      }
    },
    [user]
  );

  return { logActivity };
}
