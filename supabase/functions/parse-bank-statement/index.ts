import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * parse-bank-statement
 * Accepts { fileBase64: string, mimeType: string, organization_id: string }
 * Uses Lovable AI Gateway (Gemini) to extract rows: [{ amount, timestamp, reference, sender }]
 * Then attempts to match each row to a pending POS invoice via match_pending_pos_invoice RPC.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const body = await req.json();
    const { fileBase64, mimeType, organization_id } = body || {};
    if (!fileBase64 || !mimeType || !organization_id) {
      return json({ error: "missing fileBase64/mimeType/organization_id" }, 400);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify membership
    const { data: role } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .in("role", ["owner", "admin", "manager"])
      .maybeSingle();
    if (!role) return json({ error: "forbidden" }, 403);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "أنت محلل كشوف بنكية. استخرج كل الحركات الدائنة (credit / incoming) فقط. ارجع JSON فقط بالشكل: {\"rows\":[{\"amount\":number,\"timestamp\":ISO8601,\"reference\":string|null,\"sender\":string|null}]}",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "استخرج جميع الحركات الدائنة من هذا الكشف." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: "ai_gateway_failed", detail: txt.slice(0, 500) }, 502);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = String(raw).replace(/```json\s*|\s*```/g, "");
    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { rows: [] };
    }
    const rows: Array<{ amount: number; timestamp: string; reference?: string; sender?: string }> =
      parsed.rows || [];

    // Attempt POS matching for each row
    const results: Array<{ amount: number; timestamp: string; matched_invoice_id: string | null }> =
      [];
    for (const r of rows) {
      if (!r.amount || !r.timestamp) continue;
      const { data: matchedId } = await sb.rpc("match_pending_pos_invoice", {
        _org: organization_id,
        _amount: r.amount,
        _timestamp: r.timestamp,
        _bank_ref: r.reference || null,
      });
      results.push({
        amount: r.amount,
        timestamp: r.timestamp,
        matched_invoice_id: (matchedId as any) || null,
      });
    }

    await sb.from("system_logs").insert({
      level: "info",
      source: "parse-bank-statement",
      message: `Parsed ${rows.length} rows, matched ${results.filter((x) => x.matched_invoice_id).length}`,
      metadata: { count: rows.length, matched: results.filter((x) => x.matched_invoice_id).length },
      organization_id,
    });

    return json({
      total_rows: rows.length,
      matched: results.filter((x) => x.matched_invoice_id).length,
      results,
    });
  } catch (e: any) {
    return json({ error: e.message || "internal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
