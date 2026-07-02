import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await sb.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { connectionId } = await req.json();
    if (!connectionId || typeof connectionId !== "string") {
      return new Response(JSON.stringify({ error: "connectionId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get connection (RLS ensures user can only see their org's connections)
    const { data: connection, error: connError } = await sb
      .from("whatsapp_connections")
      .select("id, connection_type, green_api_instance_id, whatsapp_business_id")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch credentials from separate table
    const { data: creds } = await sb
      .from("whatsapp_credentials")
      .select("access_token, green_api_token")
      .eq("connection_id", connectionId)
      .single();

    let groups: { id: string; name: string; participantsCount?: number }[] = [];

    if (connection.connection_type === "green_api") {
      if (!connection.green_api_instance_id || !creds?.green_api_token) {
        return new Response(JSON.stringify({ error: "Green API credentials missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const response = await fetch(
        `https://api.green-api.com/waInstance${connection.green_api_instance_id}/getChats/${creds.green_api_token}`
      );

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch chats from Green API" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const chats = await response.json();
      
      // Filter only groups (chatId ends with @g.us)
      groups = (Array.isArray(chats) ? chats : [])
        .filter((chat: any) => chat.id?.endsWith("@g.us"))
        .map((chat: any) => ({
          id: chat.id,
          name: chat.name || chat.id,
          participantsCount: chat.participantsCount || undefined,
        }));
    } else {
      // Meta API doesn't natively support group listing in the same way
      // Return empty with a message
      return new Response(JSON.stringify({ 
        groups: [], 
        message: "فلترة المجموعات متاحة حالياً لاتصالات Green API فقط" 
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ groups }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch groups error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
