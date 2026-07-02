import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logToSystem(sb: any, level: string, message: string, metadata?: any, orgId?: string, connId?: string) {
  try {
    await sb.from("system_logs").insert({ level, source: "green-api-webhook", message, metadata: metadata || null, organization_id: orgId || null, connection_id: connId || null });
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

function isValidInstanceId(id: string): boolean {
  if (!id) return false;
  const s = String(id);
  return /^[a-zA-Z0-9]+$/.test(s) && s.length >= 5 && s.length <= 50;
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const rawBody = await req.text();
    if (rawBody.length > 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let body: any;
    try { body = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!body || typeof body !== "object" || !body.typeWebhook) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const instanceId = body.instanceData?.idInstance;
    if (!isValidInstanceId(instanceId)) {
      return new Response(JSON.stringify({ error: "Invalid instance" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: connection } = await sb
      .from("whatsapp_connections")
      .select("id, branch_id, organization_id, monitored_chat_id, branches(name)")
      .eq("green_api_instance_id", String(instanceId))
      .eq("connection_type", "green_api")
      .single();

    if (!connection) {
      await logToSystem(sb, "warn", `Unauthorized instance: ${instanceId}`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!(await checkRateLimit(sb, connection.id, connection.organization_id))) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle quota exceeded
    if (body.typeWebhook === "quotaExceeded") {
      await sb.from("whatsapp_connections").update({ status: "disconnected", updated_at: new Date().toISOString() }).eq("id", connection.id);
      const { data: members } = await sb.from("user_roles").select("user_id").eq("organization_id", connection.organization_id);
      if (members?.length) {
        await sb.from("notifications").insert(members.map((m: any) => ({
          user_id: m.user_id, organization_id: connection.organization_id,
          title: "⚠️ انتهت حصة WhatsApp",
          message: `انتهت حصة Green API للفرع "${connection.branches?.name}". يرجى تجديد الاشتراك.`,
          type: "quota_exceeded", link: "/whatsapp",
        })));
      }
      return new Response(JSON.stringify({ warning: "quota_exceeded" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.typeWebhook !== "incomingMessageReceived") {
      return new Response(JSON.stringify({ status: "ignored" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageId = body.idMessage;
    if (!isValidMsgId(messageId)) {
      return new Response(JSON.stringify({ error: "Invalid message ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageData = body.messageData || {};
    const senderData = body.senderData || {};
    const chatId = senderData.chatId || "";
    const fromNumber = senderData.sender || "";
    if (!isValidPhone(fromNumber)) {
      return new Response(JSON.stringify({ error: "Invalid sender" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group filter: if monitored_chat_id is set, only accept messages from that chat
    if (connection.monitored_chat_id && chatId && chatId !== connection.monitored_chat_id) {
      return new Response(JSON.stringify({ status: "filtered_group" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduplication
    const { data: existing } = await sb.from("whatsapp_messages").select("id").eq("message_id", messageId).limit(1);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ status: "duplicate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messageType = messageData.typeMessage || "unknown";
    const content = messageData.textMessageData?.textMessage || messageData.extendedTextMessageData?.text || null;
    const downloadUrl = messageData.fileMessageData?.downloadUrl || messageData.imageMessage?.downloadUrl || null;
    const isImage = messageType === "imageMessage";

    await sb.from("whatsapp_messages").insert({
      whatsapp_connection_id: connection.id,
      organization_id: connection.organization_id,
      message_id: messageId,
      from_number: fromNumber.substring(0, 50),
      message_type: String(messageType).substring(0, 50),
      content: content ? String(content).substring(0, 10000) : (chatId ? `chatId:${chatId}` : null),
      media_url: downloadUrl ? String(downloadUrl).substring(0, 1000) : null,
      processed: !isImage,
    });

    await sb.from("whatsapp_connections")
      .update({ last_sync_at: new Date().toISOString(), status: "connected" })
      .eq("id", connection.id);

    if (isImage && downloadUrl) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        fetch(`${supabaseUrl}/functions/v1/process-receipt`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "green-api-webhook" }),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ status: "received" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    await logToSystem(sb, "fatal", `Unhandled error: ${error?.message || error}`, { stack: error?.stack });
    console.error("Green API webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
