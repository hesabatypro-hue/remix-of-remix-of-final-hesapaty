import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ HELPERS ============
async function logToSystem(sb: any, level: string, message: string, metadata?: any, orgId?: string, connId?: string) {
  try {
    await sb.from("system_logs").insert({ level, source: "meta-webhook", message, metadata: metadata || null, organization_id: orgId || null, connection_id: connId || null });
  } catch (e) { console.error("Log error:", e); }
}

function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const c = phone.replace(/[^\d]/g, "");
  return c.length >= 7 && c.length <= 20;
}

function isValidMsgId(id: string): boolean {
  return !!id && typeof id === "string" && /^[a-zA-Z0-9_\-\.]+$/.test(id) && id.length <= 200;
}

async function verifySignature(raw: string, sig: string | null, secret: string): Promise<boolean> {
  if (!sig || !secret) return false;
  try {
    const [algo, hash] = sig.split("=");
    if (algo !== "sha256") return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    const expected = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, "0")).join("");
    return hash === expected;
  } catch { return false; }
}

// Smart per-organization rate limiting
async function checkRateLimit(sb: any, connId: string, orgId?: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000);

  // Get org-specific limit
  let maxRequests = 100;
  if (orgId) {
    const { data: org } = await sb.from("organizations").select("rate_limit_per_minute").eq("id", orgId).single();
    if (org?.rate_limit_per_minute) maxRequests = org.rate_limit_per_minute;
  }

  const { data: existing } = await sb.from("webhook_rate_limits").select("*").eq("connection_id", connId).single();
  if (!existing) {
    await sb.from("webhook_rate_limits").insert({ connection_id: connId, organization_id: orgId, window_start: now.toISOString(), request_count: 1 });
    return true;
  }
  if (new Date(existing.window_start) < windowStart) {
    await sb.from("webhook_rate_limits").update({ window_start: now.toISOString(), request_count: 1 }).eq("connection_id", connId);
    return true;
  }
  if (existing.request_count >= maxRequests) {
    await logToSystem(sb, "warn", `Rate limit exceeded: ${existing.request_count}/${maxRequests} per min`, { connectionId: connId, limit: maxRequests }, orgId, connId);
    return false;
  }
  await sb.from("webhook_rate_limits").update({ request_count: existing.request_count + 1 }).eq("connection_id", connId);
  return true;
}

// ============ MAIN HANDLER ============
serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // GET: Webhook verification
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (!VERIFY_TOKEN) {
      console.error("META_WEBHOOK_VERIFY_TOKEN is not configured — refusing verification");
      return new Response("Server misconfigured", { status: 500 });
    }
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const rawBody = await req.text();
    if (rawBody.length > 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mandatory HMAC signature verification — fail closed when secret unset.
    const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
    if (!META_APP_SECRET) {
      await logToSystem(sb, "fatal", "META_APP_SECRET not configured — rejecting webhook");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!(await verifySignature(rawBody, req.headers.get("x-hub-signature-256"), META_APP_SECRET))) {
      await logToSystem(sb, "warn", "Invalid signature rejected");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: any;
    try { body = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let savedCount = 0;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value;
        if (!value || typeof value !== "object") continue;

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const { data: connection } = await sb
          .from("whatsapp_connections")
          .select("id, branch_id, organization_id, monitored_chat_id")
          .eq("meta_phone_number_id", phoneNumberId)
          .eq("connection_type", "meta")
          .single();

        if (!connection) continue;

        // Fetch access token from credentials table
        const { data: creds } = await sb
          .from("whatsapp_credentials")
          .select("access_token")
          .eq("connection_id", connection.id)
          .single();
        const access_token = creds?.access_token || null;

        if (!connection) continue;

        if (!(await checkRateLimit(sb, connection.id, connection.organization_id))) {
          continue;
        }

        for (const message of value.messages || []) {
          if (!message || typeof message !== "object") continue;
          const messageId = message.id;
          const messageType = message.type;
          const fromNumber = message.from;
          const chatId = message.context?.from || fromNumber;

          if (!isValidMsgId(messageId) || !isValidPhone(fromNumber)) continue;

          // Group filter: if monitored_chat_id is set, only accept from that chat
          if (connection.monitored_chat_id && chatId && chatId !== connection.monitored_chat_id) continue;

          // Deduplication
          const { data: existing } = await sb.from("whatsapp_messages").select("id").eq("message_id", messageId).limit(1);
          if (existing && existing.length > 0) continue;

          const content = message.text?.body ? String(message.text.body).substring(0, 10000) : (message.image?.caption ? String(message.image.caption).substring(0, 10000) : null);
          const mediaUrl = messageType === "image" && message.image?.id ? `meta:${message.image.id}` : null;

          const { error: insertError } = await sb.from("whatsapp_messages").insert({
            whatsapp_connection_id: connection.id,
            organization_id: connection.organization_id,
            message_id: messageId,
            from_number: fromNumber.substring(0, 50),
            message_type: String(messageType || "unknown").substring(0, 50),
            content,
            media_url: mediaUrl,
            processed: messageType !== "image",
          });

          if (!insertError) savedCount++;

          // 🔗 DELAYED MEMO LINKING for text messages
          const isTextMsg = ["text", "textMessage", "extendedTextMessage"].includes(String(messageType));
          if (isTextMsg && content && !content.startsWith("chatId:") && content.trim().length > 0) {
            try {
              const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
              const cleanText = String(content).substring(0, 500).trim();
              const { data: recentTransfers } = await sb
                .from("transfers")
                .select("id, client_memo, is_manual_memo")
                .eq("organization_id", connection.organization_id)
                .eq("sender_phone", fromNumber.substring(0, 50))
                .eq("is_deleted", false)
                .eq("is_manual_memo", false)
                .gte("created_at", tenMinAgo)
                .order("created_at", { ascending: false })
                .limit(1);

              if (recentTransfers && recentTransfers.length > 0) {
                const transfer = recentTransfers[0];
                const updatedMemo = transfer.client_memo
                  ? `${transfer.client_memo} | ${cleanText}`
                  : cleanText;
                await sb.from("transfers").update({
                  client_memo: updatedMemo.substring(0, 2000),
                }).eq("id", transfer.id);
                await logToSystem(sb, "info",
                  `Delayed memo linked: transfer=${transfer.id}, text="${cleanText.substring(0, 100)}"`,
                  { transferId: transfer.id, fromNumber, newText: cleanText },
                  connection.organization_id, connection.id
                );
              }
            } catch (memoErr: any) {
              await logToSystem(sb, "warn", `Delayed memo linking failed: ${memoErr?.message}`, {}, connection.organization_id, connection.id);
            }
          }
        }

        // Update last sync
        await sb.from("whatsapp_connections")
          .update({ last_sync_at: new Date().toISOString(), status: "connected" })
          .eq("id", connection.id);
      }
    }

    // Fire-and-forget: trigger async processing if there are images
    if (savedCount > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/process-receipt`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "meta-webhook" }),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ status: "received", saved: savedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    await logToSystem(sb, "fatal", `Unhandled error: ${error?.message || error}`, { stack: error?.stack });
    console.error("Meta webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
