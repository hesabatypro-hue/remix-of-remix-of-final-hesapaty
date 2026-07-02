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
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user with their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { transferId } = await req.json();
    if (!transferId) {
      return new Response(JSON.stringify({ error: "Missing transferId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to check transfer + org membership
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: transfer, error: transferError } = await adminClient
      .from("transfers")
      .select("id, image_url, organization_id")
      .eq("id", transferId)
      .eq("is_deleted", false)
      .single();

    if (transferError || !transfer) {
      return new Response(JSON.stringify({ error: "Transfer not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to the organization
    const { data: isMember } = await adminClient.rpc("is_organization_member", {
      _user_id: userId,
      _organization_id: transfer.organization_id,
    });

    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transfer.image_url) {
      return new Response(JSON.stringify({ error: "No image" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle storage path format: "storage:receipts/orgId/file.ext"
    let filePath: string | null = null;

    if (transfer.image_url.startsWith("storage:receipts/")) {
      filePath = transfer.image_url.replace("storage:receipts/", "");
    } else {
      // Legacy: full public URL format
      const storageBase = `${supabaseUrl}/storage/v1/object/public/receipts/`;
      if (transfer.image_url.startsWith(storageBase)) {
        filePath = transfer.image_url.replace(storageBase, "");
      }
    }

    if (filePath) {
      const { data: signedData, error: signError } = await adminClient
        .storage.from("receipts")
        .createSignedUrl(filePath, 120); // 2 minutes

      if (signError || !signedData?.signedUrl) {
        return new Response(JSON.stringify({ error: "Failed to generate signed URL" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: signedData.signedUrl }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // For non-storage URLs (legacy external), return as-is
    return new Response(JSON.stringify({ url: transfer.image_url }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Secure image error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
