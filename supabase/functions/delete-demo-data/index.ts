import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    // Verify caller is admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const { data: roleData } = await userClient.rpc("get_user_role", { _user_id: user.id });
    if (roleData !== "admin") throw new Error("Admin only");

    // Use service role to delete data
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Delete in FK-safe order
    const tables = [
      "sale_items",
      "sales",
      "payments",
      "invoices",
      "purchase_order_items",
      "purchase_orders",
      "inventory_items",
      "inventory_sessions",
      "expenses",
      "activity_logs",
      "products",
      "categories",
      "suppliers",
    ];

    const results: Record<string, string> = {};

    for (const table of tables) {
      // Delete all rows by using a filter that matches everything
      const { error } = await admin.from(table).delete().gte("created_at", "1900-01-01");
      results[table] = error ? `error: ${error.message}` : "cleared";
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
