import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[^\d]/g, "");
  return cleaned.length >= 7 && cleaned.length <= 20;
}

function isValidMessageId(messageId: string): boolean {
  if (!messageId || typeof messageId !== "string") return false;
  return /^[a-zA-Z0-9_\-\.]+$/.test(messageId) && messageId.length <= 200;
}

async function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader) return false;
  // 🔒 Fail closed: an unconfigured secret must never be treated as "valid".
  if (!appSecret) return false;
  try {
    const parts = signatureHeader.split("=");
    if (parts.length !== 2 || parts[0] !== "sha256") return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
    return parts[1] === expected;
  } catch { return false; }
}

// ============ MAIN HANDLER (DECOUPLED - save only) ============
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);

    // GET: Webhook verification
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") || 'lovable_whatsapp_verify';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new Response(challenge, { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
      }
      return new Response('Verification failed', { status: 403, headers: corsHeaders });
    }

    // POST: Save message and return immediately
    if (req.method === 'POST') {
      const rawBody = await req.text();
      if (rawBody.length > 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Payload too large" }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
      if (META_APP_SECRET) {
        const isValid = await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), META_APP_SECRET);
        if (!isValid) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      let body: any;
      try { body = JSON.parse(rawBody); } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      let saved = 0;

      if (value?.messages && Array.isArray(value.messages)) {
        for (const message of value.messages) {
          if (!message || typeof message !== "object") continue;
          const fromNumber = message.from;
          const messageId = message.id;
          const messageType = message.type;
          if (!isValidMessageId(messageId) || !isValidPhoneNumber(fromNumber)) continue;

          // Deduplication
          const { data: existing } = await supabase.from("whatsapp_messages").select("id").eq("message_id", messageId).limit(1);
          if (existing && existing.length > 0) continue;

          const displayPhoneNumber = value.metadata?.display_phone_number;
          if (!displayPhoneNumber) continue;

          const { data: connection } = await supabase
            .from('whatsapp_connections')
            .select('id, branch_id, organization_id')
            .eq('phone_number', `+${displayPhoneNumber}`)
            .single();

          if (!connection) continue;

          const content = messageType === 'text' ? (message.text?.body ? String(message.text.body).substring(0, 10000) : null)
            : (message.image?.caption ? String(message.image.caption).substring(0, 10000) : null);

          const mediaUrl = messageType === 'image' && message.image?.id ? `meta:${message.image.id}` : null;

          await supabase.from('whatsapp_messages').insert({
            whatsapp_connection_id: connection.id,
            organization_id: connection.organization_id,
            message_id: messageId,
            from_number: fromNumber.substring(0, 50),
            message_type: String(messageType || "unknown").substring(0, 50),
            content,
            media_url: mediaUrl,
            processed: messageType !== 'image',
          });

          saved++;

          await supabase.from('whatsapp_connections')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', connection.id);
        }
      }

      // Fire-and-forget: trigger async processing
      if (saved > 0) {
        fetch(`${supabaseUrl}/functions/v1/process-receipt`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${supabaseServiceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ trigger: "whatsapp-webhook" }),
        }).catch(() => {});
      }

      return new Response(JSON.stringify({ success: true, saved }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
