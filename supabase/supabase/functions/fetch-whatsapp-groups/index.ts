import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// SECURITY: Restrict CORS to known origins only
const ALLOWED_ORIGINS = [
  "https://hesabaty-sd.netlify.app",
  "https://hesapaty.lovable.app",
  "http://localhost:5173",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const _origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(_origin);
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
      .select("id, connection_type, green_api_instance_id, green_api_token, access_token, whatsapp_business_id")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let groups: { id: string; name: string; participantsCount?: number }[] = [];

    if (connection.connection_type === "green_api") {
      if (!connection.green_api_instance_id || !connection.green_api_token) {
        return new Response(JSON.stringify({ error: "Green API credentials missing" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const response = await fetch(
        `https://api.green-api.com/waInstance${connection.green_api_instance_id}/getChats/${connection.green_api_token}`
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
