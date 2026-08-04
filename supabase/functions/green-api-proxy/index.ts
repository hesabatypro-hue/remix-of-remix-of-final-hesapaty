import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GREEN = "https://api.green-api.com";

function isValidInstanceId(id: unknown): boolean {
  const s = String(id ?? "");
  return /^[a-zA-Z0-9]{5,50}$/.test(s);
}
function isValidToken(t: unknown): boolean {
  const s = String(t ?? "");
  return /^[a-zA-Z0-9_\-]{10,200}$/.test(s);
}
function isUuid(v: unknown): boolean {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function greenSetSettings(instanceId: string, token: string, webhookUrl: string, webhookToken: string) {
  const res = await fetch(`${GREEN}/waInstance${instanceId}/setSettings/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookUrl,
      webhookUrlToken: webhookToken,
      delaySendMessagesMilliseconds: 1000,
      markIncomingMessagesReaded: "yes",
      markIncomingMessagesReadedOnReply: "yes",
      outgoingWebhook: "yes",
      outgoingMessageWebhook: "yes",
      incomingWebhook: "yes",
      deviceWebhook: "no",
    }),
  });
  if (!res.ok) throw new Error("فشل إعداد Webhook لدى Green API");
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const webhookSecret = Deno.env.get("GREEN_API_WEBHOOK_SECRET") ?? "";

  // ---- Authenticate the caller (verify_jwt is disabled by default) ----
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "Unauthorized" }, 401);
  const presented = authHeader.slice(7).trim();

  const sb = createClient(supabaseUrl, serviceKey);

  // Service-role maintenance path: re-register the secured webhook on every
  // existing Green API instance (used once after enabling the webhook secret).
  if (serviceKey && presented === serviceKey) {
    let maintenanceBody: any = {};
    try { maintenanceBody = await req.json(); } catch { /* ignore */ }
    if (maintenanceBody?.action !== "reset_all_webhooks") return json({ error: "Unknown action" }, 400);

    const { data: conns } = await sb
      .from("whatsapp_connections")
      .select("id, green_api_instance_id, whatsapp_credentials(green_api_token)")
      .eq("connection_type", "green_api");

    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const c of conns ?? []) {
      const cred: any = Array.isArray((c as any).whatsapp_credentials)
        ? (c as any).whatsapp_credentials[0]
        : (c as any).whatsapp_credentials;
      const token = cred?.green_api_token;
      if (!c.green_api_instance_id || !token) {
        results.push({ id: c.id, ok: false, error: "missing credentials" });
        continue;
      }
      try {
        await greenSetSettings(
          String(c.green_api_instance_id),
          token,
          `${supabaseUrl}/functions/v1/green-api-webhook`,
          webhookSecret,
        );
        results.push({ id: c.id, ok: true });
      } catch (e) {
        results.push({ id: c.id, ok: false, error: (e as Error).message });
      }
    }
    return json({ ok: true, results });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);



  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body?.action || "");

  // Verify the caller is owner/admin of an organization
  async function requireOrgAdmin(orgId: string): Promise<boolean> {
    const { data } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    return !!data;
  }

  // Load a connection + its token, enforcing that the caller owns it
  async function loadConnection(connectionId: string) {
    if (!isUuid(connectionId)) throw new Error("معرّف اتصال غير صالح");
    const { data: conn } = await sb
      .from("whatsapp_connections")
      .select("id, organization_id, green_api_instance_id, connection_type")
      .eq("id", connectionId)
      .maybeSingle();
    if (!conn) throw new Error("الاتصال غير موجود");
    if (!(await requireOrgAdmin(conn.organization_id))) throw new Error("FORBIDDEN");
    if (conn.connection_type !== "green_api") throw new Error("هذا الاتصال ليس من نوع Green API");
    const { data: creds } = await sb
      .from("whatsapp_credentials")
      .select("green_api_token")
      .eq("connection_id", conn.id)
      .maybeSingle();
    if (!creds?.green_api_token) throw new Error("بيانات Green API غير مكتملة");
    return { conn, token: creds.green_api_token as string };
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/green-api-webhook`;

  try {
    switch (action) {
      // Validate credentials the admin just typed (never stored client-side)
      case "test": {
        const { instanceId, apiToken } = body;
        if (!isValidInstanceId(instanceId) || !isValidToken(apiToken)) {
          return json({ error: "بيانات Green API غير صالحة" }, 400);
        }
        const res = await fetch(`${GREEN}/waInstance${instanceId}/getSettings/${apiToken}`);
        if (!res.ok) return json({ error: "فشل الاتصال بـ Green API" }, 400);
        return json({ ok: true, data: await res.json() });
      }

      // Create the connection, store the token server-side and register the webhook
      case "save": {
        const { branchId, phoneNumber, instanceId, apiToken, organizationId } = body;
        if (!isUuid(branchId) || !isUuid(organizationId)) return json({ error: "بيانات غير صالحة" }, 400);
        if (!isValidInstanceId(instanceId) || !isValidToken(apiToken)) {
          return json({ error: "بيانات Green API غير صالحة" }, 400);
        }
        if (!(await requireOrgAdmin(organizationId))) return json({ error: "غير مصرح" }, 403);

        // The organization must have signed the liability waiver first
        const { data: org } = await sb
          .from("organizations")
          .select("whatsapp_liability_accepted_at")
          .eq("id", organizationId)
          .maybeSingle();
        if (!org?.whatsapp_liability_accepted_at) {
          return json({ error: "LIABILITY_NOT_ACCEPTED" }, 412);
        }

        // The branch must belong to the organization
        const { data: branch } = await sb
          .from("branches")
          .select("id")
          .eq("id", branchId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (!branch) return json({ error: "الفرع غير تابع لهذه المؤسسة" }, 403);

        const { data: conn, error: connErr } = await sb
          .from("whatsapp_connections")
          .insert({
            branch_id: branchId,
            phone_number: String(phoneNumber || "").slice(0, 32),
            connection_type: "green_api",
            green_api_instance_id: String(instanceId),
            status: "pending",
            organization_id: organizationId,
          })
          .select("id")
          .single();
        if (connErr) {
          const msg = (connErr as any).code === "23505" ? "هذا الفرع أو الرقم مرتبط مسبقاً" : "فشل في إضافة الربط";
          return json({ error: msg }, 400);
        }

        const { error: credErr } = await sb
          .from("whatsapp_credentials")
          .insert({ connection_id: conn.id, green_api_token: apiToken });
        if (credErr) {
          await sb.from("whatsapp_connections").delete().eq("id", conn.id);
          return json({ error: "فشل في حفظ بيانات الاعتماد" }, 400);
        }

        try {
          await greenSetSettings(String(instanceId), String(apiToken), webhookUrl, webhookSecret);
        } catch (_) {
          // The connection is stored; the admin can retry webhook setup from the UI
          return json({ ok: true, connectionId: conn.id, webhookConfigured: false });
        }
        return json({ ok: true, connectionId: conn.id, webhookConfigured: true });
      }

      // Health check for any connection type, without exposing tokens
      case "connection_test": {
        const connectionId = body.connectionId;
        if (!isUuid(connectionId)) return json({ error: "معرّف اتصال غير صالح" }, 400);
        const { data: conn } = await sb
          .from("whatsapp_connections")
          .select("id, organization_id, connection_type, green_api_instance_id, whatsapp_business_id")
          .eq("id", connectionId)
          .maybeSingle();
        if (!conn) return json({ error: "لم يتم العثور على الاتصال" }, 404);
        if (!(await requireOrgAdmin(conn.organization_id))) return json({ error: "غير مصرح" }, 403);
        const { data: creds } = await sb
          .from("whatsapp_credentials")
          .select("green_api_token, access_token")
          .eq("connection_id", conn.id)
          .maybeSingle();

        if (conn.connection_type === "green_api") {
          if (!conn.green_api_instance_id || !creds?.green_api_token) {
            return json({ error: "بيانات Green API غير مكتملة" }, 400);
          }
          const res = await fetch(`${GREEN}/waInstance${conn.green_api_instance_id}/getStateInstance/${creds.green_api_token}`);
          if (!res.ok) return json({ error: "فشل الاتصال بـ Green API" }, 400);
          const data = await res.json();
          if (data.stateInstance !== "authorized") {
            return json({ error: `حالة الاتصال: ${data.stateInstance || "غير معروف"}` }, 400);
          }
          return json({ ok: true, data });
        }

        if (!conn.whatsapp_business_id || !creds?.access_token) {
          return json({ error: "بيانات Meta API غير مكتملة" }, 400);
        }
        const res = await fetch(`https://graph.facebook.com/v18.0/${conn.whatsapp_business_id}`, {
          headers: { Authorization: `Bearer ${creds.access_token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return json({ error: err?.error?.message || "فشل الاتصال بـ WhatsApp API" }, 400);
        }
        return json({ ok: true, data: await res.json() });
      }

      case "state": {

        const { conn, token } = await loadConnection(body.connectionId);
        const res = await fetch(`${GREEN}/waInstance${conn.green_api_instance_id}/getStateInstance/${token}`);
        if (!res.ok) return json({ error: "فشل جلب حالة الاتصال" }, 400);
        return json({ ok: true, data: await res.json() });
      }

      case "reboot": {
        const { conn, token } = await loadConnection(body.connectionId);
        const res = await fetch(`${GREEN}/waInstance${conn.green_api_instance_id}/reboot/${token}`);
        if (!res.ok) return json({ error: "فشل إعادة تشغيل الاتصال" }, 400);
        return json({ ok: true, data: await res.json() });
      }

      case "reset_webhook": {
        const { conn, token } = await loadConnection(body.connectionId);
        const data = await greenSetSettings(String(conn.green_api_instance_id), token, webhookUrl, webhookSecret);
        return json({ ok: true, data });
      }

      case "activate": {
        const { conn, token } = await loadConnection(body.connectionId);
        const stateRes = await fetch(`${GREEN}/waInstance${conn.green_api_instance_id}/getStateInstance/${token}`);
        if (!stateRes.ok) return json({ error: "فشل جلب حالة الاتصال" }, 400);
        const state = await stateRes.json();

        if (state.stateInstance === "authorized") {
          await sb
            .from("whatsapp_connections")
            .update({ status: "connected", last_sync_at: new Date().toISOString() })
            .eq("id", conn.id);
          // Make sure the webhook + secret are in place on every activation
          try {
            await greenSetSettings(String(conn.green_api_instance_id), token, webhookUrl, webhookSecret);
          } catch { /* non fatal */ }
          return json({ ok: true, status: "already_connected", state });
        }

        const rebootRes = await fetch(`${GREEN}/waInstance${conn.green_api_instance_id}/reboot/${token}`);
        if (!rebootRes.ok) return json({ error: "فشل إعادة تشغيل الاتصال" }, 400);
        await sb.from("whatsapp_connections").update({ status: "pending" }).eq("id", conn.id);
        return json({ ok: true, status: "rebooted", state });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    const msg = (e as Error)?.message || "خطأ غير متوقع";
    if (msg === "FORBIDDEN") return json({ error: "غير مصرح" }, 403);
    console.error("green-api-proxy error:", msg);
    return json({ error: msg }, 400);
  }
});
