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

// ============ ADMIN COMMAND PARSER ============
const INTENT_WORDS = ["ملخص","إيراد","ايراد","إيرادات","ايرادات","دخل","تقرير","حسابات","revenue","summary","report"];
const TODAY_WORDS = ["اليوم","النهارده","النهاردة","today"];
const MONTHS: Record<number, string[]> = {
  1: ["1","01","يناير","january","jan","واحد"],
  2: ["2","02","فبراير","february","feb","اثنين","اتنين"],
  3: ["3","03","مارس","march","mar","ثلاثة","تلاته"],
  4: ["4","04","أبريل","ابريل","april","apr","اربعة","أربعة"],
  5: ["5","05","مايو","may","خمسة","خمسه"],
  6: ["6","06","يونيو","يونيه","june","jun","ستة","سته"],
  7: ["7","07","يوليو","يوليه","july","jul","سبعة","سبعه"],
  8: ["8","08","أغسطس","اغسطس","august","aug","ثمانية","تمانية"],
  9: ["9","09","سبتمبر","september","sep","sept","تسعة","تسعه"],
  10: ["10","أكتوبر","اكتوبر","october","oct","عشرة","عشره"],
  11: ["11","نوفمبر","november","nov","احد عشر","إحدى عشر"],
  12: ["12","ديسمبر","december","dec","اثنا عشر","اثنى عشر"],
};

function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectMonth(norm: string): number | null {
  const tokens = norm.split(/\s+/);
  for (const [num, variants] of Object.entries(MONTHS)) {
    for (const v of variants) {
      const vn = normalizeArabic(v);
      if (tokens.includes(vn) || norm.includes(` ${vn} `) || norm.startsWith(vn + " ") || norm.endsWith(" " + vn) || norm === vn) {
        return parseInt(num, 10);
      }
    }
  }
  return null;
}

function parseSenderPhone(sender: string): string {
  return String(sender || "").replace(/[^\d]/g, "");
}

async function sendGreenApiDM(instanceId: string, token: string, chatId: string, message: string): Promise<boolean> {
  try {
    const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    });
    return res.ok;
  } catch { return false; }
}

function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n || 0);
}

// Sudan is UTC+2 (no DST). Compute [start,end] UTC bounds for a "Sudan day/month".
const SUDAN_OFFSET_HOURS = 2;
function sudanDayBounds(year: number, monthIdx: number, day: number): { startUTC: Date; endUTC: Date; dateStr: string } {
  // Sudan midnight = UTC (day 00:00 - 2h) => previous day 22:00 UTC
  const startUTC = new Date(Date.UTC(year, monthIdx, day, 0 - SUDAN_OFFSET_HOURS, 0, 0));
  const endUTC = new Date(Date.UTC(year, monthIdx, day + 1, 0 - SUDAN_OFFSET_HOURS, 0, 0));
  const dateStr = `${String(day).padStart(2,"0")}-${String(monthIdx+1).padStart(2,"0")}-${year}`;
  return { startUTC, endUTC, dateStr };
}
function sudanNow(): { year: number; monthIdx: number; day: number } {
  const now = new Date(Date.now() + SUDAN_OFFSET_HOURS * 3600 * 1000);
  return { year: now.getUTCFullYear(), monthIdx: now.getUTCMonth(), day: now.getUTCDate() };
}

// Check if sender is a WhatsApp group admin via Green API getGroupData
async function isWhatsappGroupAdmin(instanceId: string, token: string, groupChatId: string, senderDigits: string): Promise<boolean> {
  try {
    if (!groupChatId || !groupChatId.endsWith("@g.us")) return false;
    const url = `https://api.green-api.com/waInstance${instanceId}/getGroupData/${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: groupChatId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    const participants = data?.participants || [];
    const target = senderDigits.replace(/[^\d]/g, "");
    for (const p of participants) {
      const pid = String(p?.id || "").replace(/[^\d]/g, "");
      const isAdmin = p?.isAdmin === true || p?.isSuperAdmin === true;
      if (isAdmin && pid && (pid === target || pid.endsWith(target.slice(-9)) || target.endsWith(pid.slice(-9)))) {
        return true;
      }
    }
    return false;
  } catch { return false; }
}

async function tryHandleAdminCommand(sb: any, ctx: {
  organization_id: string; connection_id: string; instanceId: string; senderRaw: string; text: string; chatId: string;
}): Promise<{ handled: boolean; intent?: string }> {
  const norm = normalizeArabic(ctx.text);
  const hasIntent = INTENT_WORDS.some(w => norm.includes(normalizeArabic(w)));
  if (!hasIntent) return { handled: false };

  const senderDigits = parseSenderPhone(ctx.senderRaw);

  // Fetch token early (needed for both auth check and reply)
  const { data: creds } = await sb.from("whatsapp_credentials").select("green_api_token").eq("connection_id", ctx.connection_id).maybeSingle();
  const token = creds?.green_api_token;

  // 🔐 Admin validation: (A) DB profile+role, OR (B) WhatsApp group admin of monitored chat
  let authorized = false;
  let authSource = "";

  const { data: profiles } = await sb.from("profiles").select("id, phone").not("phone", "is", null);
  const matched = (profiles || []).find((p: any) => {
    const pd = String(p.phone || "").replace(/[^\d]/g, "");
    return pd && (pd === senderDigits || pd.endsWith(senderDigits.slice(-9)) || senderDigits.endsWith(pd.slice(-9)));
  });
  if (matched) {
    const { data: roleRow } = await sb.from("user_roles")
      .select("role").eq("user_id", matched.id).eq("organization_id", ctx.organization_id)
      .in("role", ["owner","admin"]).maybeSingle();
    if (roleRow) { authorized = true; authSource = "db_role"; }
  }

  if (!authorized && token && ctx.chatId && ctx.chatId.endsWith("@g.us")) {
    const isGroupAdmin = await isWhatsappGroupAdmin(ctx.instanceId, token, ctx.chatId, senderDigits);
    if (isGroupAdmin) { authorized = true; authSource = "whatsapp_group_admin"; }
  }

  if (!authorized) {
    await logToSystem(sb, "warn", `Command from unauthorized sender: ${senderDigits}`, { sender: senderDigits, chatId: ctx.chatId }, ctx.organization_id, ctx.connection_id);
    return { handled: true };
  }

  // Determine range (Sudan timezone)
  const isToday = TODAY_WORDS.some(w => norm.includes(normalizeArabic(w)));
  const month = isToday ? null : detectMonth(norm);
  const sn = sudanNow();
  let startUTC: Date, endUTC: Date, isMonthly = false, monthLabel = "", displayDate = "", lastDayLabel = "";
  if (isToday || (!month && !isToday)) {
    const b = sudanDayBounds(sn.year, sn.monthIdx, sn.day);
    startUTC = b.startUTC; endUTC = b.endUTC; displayDate = b.dateStr;
  } else {
    isMonthly = true;
    const m = month as number;
    const lastDay = new Date(Date.UTC(sn.year, m, 0)).getUTCDate();
    const s = sudanDayBounds(sn.year, m - 1, 1);
    const e = sudanDayBounds(sn.year, m - 1, lastDay);
    startUTC = s.startUTC; endUTC = e.endUTC;
    monthLabel = String(m).padStart(2, "0");
    lastDayLabel = String(lastDay).padStart(2, "0");
  }
  const startDateStr = new Date(startUTC.getTime() + SUDAN_OFFSET_HOURS * 3600 * 1000).toISOString().slice(0, 10);
  const endDateStr = new Date(endUTC.getTime() + SUDAN_OFFSET_HOURS * 3600 * 1000 - 1).toISOString().slice(0, 10);
  const startISO = startUTC.toISOString();
  const endISO = endUTC.toISOString();

  // Query transfers: match by transfer_date OR created_at (Sudan window) to be robust
  const { data: rows } = await sb
    .from("transfers")
    .select("amount, is_confirmed, needs_review, fraud_score, transfer_date, created_at")
    .eq("organization_id", ctx.organization_id)
    .eq("is_deleted", false)
    .or(
      `and(transfer_date.gte.${startDateStr},transfer_date.lte.${endDateStr}),` +
      `and(created_at.gte.${startISO},created_at.lt.${endISO})`
    );

  let revenue = 0, confirmedCount = 0, fraudCount = 0;
  for (const r of rows || []) {
    if (r.is_confirmed) { revenue += Number(r.amount || 0); confirmedCount++; }
    if ((r.fraud_score || 0) > 0 || r.needs_review) fraudCount++;
  }

  // Also count duplicates from system_logs for the same window
  try {
    const { data: dupLogs } = await sb.from("system_logs").select("id")
      .eq("organization_id", ctx.organization_id)
      .in("level", ["warn","error"])
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .like("message", "%duplicate%");
    if (dupLogs) fraudCount += dupLogs.length;
  } catch {}

  // Build response
  let msg = "";
  if (isMonthly) {
    msg = `📊 حساباتي PRO - ملخص الأداء المالي لشهر ${monthLabel}\n` +
          `📅 الفترة: من 01-${monthLabel}-${sn.year} إلى ${lastDayLabel}-${monthLabel}-${sn.year}\n` +
          `💰 إجمالي الإيرادات المسجلة: ${fmtNum(revenue)} ج.س\n` +
          `✅ الاشعارات المؤكدة: ${confirmedCount} عملية\n` +
          `❌ محاولات الاحتيال/التكرار المرفوضة: ${fraudCount} عملية\n` +
          `📈 النظام يعمل بكفاءة وتم التحديث تلقائياً.`;
  } else {
    msg = `📊 حساباتي PRO - ملخص الأداء المالي اليوم\n` +
          `📅 التاريخ: ${displayDate}\n` +
          `💰 إجمالي الإيرادات المسجلة: ${fmtNum(revenue)} ج.س\n` +
          `✅ الاشعارات المؤكدة: ${confirmedCount} عملية\n` +
          `❌ محاولات الاحتيال/التكرار المرفوضة: ${fraudCount} عملية\n` +
          `📈 النظام يعمل بكفاءة وتم التحديث تلقائياً.`;
  }

  if (!token) {
    await logToSystem(sb, "error", "Cannot send admin command reply: missing green_api_token", {}, ctx.organization_id, ctx.connection_id);
    return { handled: true, intent: isMonthly ? "monthly" : "daily" };
  }
  const privateChatId = `${senderDigits}@c.us`;
  const ok = await sendGreenApiDM(ctx.instanceId, token, privateChatId, msg);
  await logToSystem(sb, ok ? "info" : "error", `Admin command reply ${ok ? "sent" : "FAILED"} to ${privateChatId}`, { intent: isMonthly ? "monthly" : "daily", revenue, confirmedCount, fraudCount, authSource }, ctx.organization_id, ctx.connection_id);
  return { handled: true, intent: isMonthly ? "monthly" : "daily" };
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

    // Handle quota exceeded — SOFT warning + AUTO-RECOVERY of missed messages
    if (body.typeWebhook === "quotaExceeded") {
      await logToSystem(sb, "warn", `Green API quotaExceeded — starting recovery for instance ${instanceId}`, { branch: connection.branches?.name }, connection.organization_id, connection.id);

      const { data: creds } = await sb.from("whatsapp_credentials")
        .select("green_api_token").eq("connection_id", connection.id).maybeSingle();
      const token = creds?.green_api_token;

      let recovered = 0;
      if (token) {
        try {
          const res = await fetch(`https://api.green-api.com/waInstance${instanceId}/lastIncomingMessages/${token}?minutes=60`);
          if (res.ok) {
            const msgs: any[] = await res.json();
            for (const m of (Array.isArray(msgs) ? msgs : [])) {
              const mid = m?.idMessage;
              const mChat = m?.chatId || "";
              const mSender = m?.senderId || "";
              const mType = m?.typeMessage || "unknown";
              const mDown = m?.downloadUrl || null;
              const mCaption = m?.caption || m?.textMessage || null;
              if (!isValidMsgId(mid) || !isValidPhone(mSender)) continue;

              const { data: dup } = await sb.from("whatsapp_messages").select("id").eq("message_id", mid).limit(1);
              if (dup && dup.length > 0) continue;

              if (mChat.endsWith("@g.us")) {
                const isMonitored = connection.monitored_chat_id && mChat === connection.monitored_chat_id;
                if (!isMonitored) {
                  const { data: bm } = await sb.from("branches").select("id")
                    .eq("organization_id", connection.organization_id)
                    .eq("whatsapp_chat_id", mChat)
                    .eq("is_deleted", false).eq("is_active", true)
                    .limit(1).maybeSingle();
                  if (!bm) continue;
                }
              }

              const isImg = mType === "imageMessage";
              await sb.from("whatsapp_messages").insert({
                whatsapp_connection_id: connection.id,
                organization_id: connection.organization_id,
                message_id: mid,
                from_number: String(mSender).substring(0, 50),
                message_type: String(mType).substring(0, 50),
                content: mCaption ? String(mCaption).substring(0, 10000) : (mChat ? `chatId:${mChat}` : null),
                chat_id: mChat ? String(mChat).substring(0, 100) : null,
                media_url: mDown ? String(mDown).substring(0, 1000) : null,
                processed: !isImg,
              });
              recovered++;
            }

            if (recovered > 0) {
              const supabaseUrl = Deno.env.get("SUPABASE_URL");
              const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
              if (supabaseUrl && serviceKey) {
                fetch(`${supabaseUrl}/functions/v1/process-receipt`, {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ trigger: "quota-recovery" }),
                }).catch(() => {});
              }
              await logToSystem(sb, "info", `Recovered ${recovered} missed message(s) after quotaExceeded`, { recovered }, connection.organization_id, connection.id);
            }
          }
        } catch (recErr: any) {
          await logToSystem(sb, "error", `Recovery pull failed: ${recErr?.message}`, {}, connection.organization_id, connection.id);
        }
      }

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await sb.from("notifications").select("id")
        .eq("organization_id", connection.organization_id).eq("type", "quota_exceeded")
        .gte("created_at", dayAgo).limit(1);
      if (!recent || recent.length === 0) {
        const { data: members } = await sb.from("user_roles").select("user_id")
          .eq("organization_id", connection.organization_id).in("role", ["owner", "admin"]);
        if (members?.length) {
          await sb.from("notifications").insert(members.map((m: any) => ({
            user_id: m.user_id, organization_id: connection.organization_id,
            title: "⚠️ حصة Green API — تم الاسترداد التلقائي",
            message: `Green API تجاوزت حصّة تسليم الويبهوكس مؤقتاً. تم استرداد ${recovered} رسالة فائتة تلقائياً. النظام يعمل بشكل طبيعي.`,
            type: "quota_exceeded", link: "/whatsapp",
          })));
        }
      }
      return new Response(JSON.stringify({ warning: "quota_exceeded_soft", recovered }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // 🧠 SMART MULTI-BRANCH FILTER
    // Accept messages from:
    //   (a) the primary monitored_chat_id (legacy single-group setup), OR
    //   (b) ANY group linked to a branch in this org via branches.whatsapp_chat_id,
    //   (c) private DMs (@c.us) — needed for admin summary commands.
    // Reject unrelated groups (@g.us) that aren't linked to any branch.
    if (chatId && chatId.endsWith("@g.us")) {
      const isMonitored = connection.monitored_chat_id && chatId === connection.monitored_chat_id;
      let isBranchGroup = false;
      if (!isMonitored) {
        const { data: branchMatch } = await sb
          .from("branches")
          .select("id")
          .eq("organization_id", connection.organization_id)
          .eq("whatsapp_chat_id", chatId)
          .eq("is_deleted", false)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        isBranchGroup = !!branchMatch;
      }
      if (!isMonitored && !isBranchGroup) {
        return new Response(JSON.stringify({ status: "filtered_group" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
      chat_id: chatId ? String(chatId).substring(0, 100) : null,
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

    const isTextMessage = ["textMessage", "extendedTextMessage"].includes(messageType);

    // 🧠 ADMIN COMMAND PARSER (private DM reply, admin-only)
    if (isTextMessage && content && content.trim().length > 0) {
      const cmd = await tryHandleAdminCommand(sb, {
        organization_id: connection.organization_id,
        connection_id: connection.id,
        instanceId: String(instanceId),
        senderRaw: fromNumber,
        text: content,
        chatId: chatId,
      });
      if (cmd?.handled) {
        return new Response(JSON.stringify({ status: "command_handled", intent: cmd.intent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // 🔗 DELAYED MEMO LINKING
    if (isTextMessage && content && !content.startsWith("chatId:") && content.trim().length > 0) {
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
          const updatedMemo = transfer.client_memo ? `${transfer.client_memo} | ${cleanText}` : cleanText;
          await sb.from("transfers").update({ client_memo: updatedMemo.substring(0, 2000) }).eq("id", transfer.id);
          await logToSystem(sb, "info", `Delayed memo linked: transfer=${transfer.id}`, { transferId: transfer.id, fromNumber }, connection.organization_id, connection.id);
        }
      } catch (memoErr: any) {
        await logToSystem(sb, "warn", `Delayed memo linking failed: ${memoErr?.message}`, {}, connection.organization_id, connection.id);
      }
    }

    return new Response(JSON.stringify({ status: "received" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    await logToSystem(sb, "fatal", `Unhandled error: ${error?.message || error}`, { stack: error?.stack });
    console.error("Green API webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
