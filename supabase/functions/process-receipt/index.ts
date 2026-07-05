import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONCURRENT = 5;
const AI_RATE_LIMIT_DELAY = 500;
const SMART_LINK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// ============ HELPERS ============
function validateAndParseAmount(amount: any): number {
  if (amount === null || amount === undefined) return 0;
  const parsed = parseFloat(String(amount));
  if (isNaN(parsed) || parsed < 0 || parsed > 1000000000) return 0;
  return parsed;
}

function isValidDate(dateStr: any): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return !isNaN(new Date(dateStr).getTime());
}

async function computeImageHash(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function bufferToBase64DataUrl(buffer: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function detectMimeType(buffer: Uint8Array): string {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return "image/gif";
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

// ============ FRAUD DETECTION ENGINE ============
interface FraudResult {
  score: number;
  flags: string[];
}

async function detectFraud(
  sb: any, buffer: Uint8Array, imageHash: string,
  analysis: { amount: number; date: string | null; sender: string | null; reference: string | null; confidence: number },
  orgId: string, fromNumber: string
): Promise<FraudResult> {
  const flags: string[] = [];
  let score = 0;

  const sizeKB = buffer.length / 1024;
  if (sizeKB < 10) { flags.push("image_too_small"); score += 15; }
  if (sizeKB > 8000) { flags.push("image_unusually_large"); score += 10; }

  const { data: dupHash } = await sb.from("transfers").select("id").eq("image_hash", imageHash).eq("organization_id", orgId).eq("is_deleted", false).limit(1);
  if (dupHash && dupHash.length > 0) { flags.push("duplicate_image_hash"); score += 50; }

  if (fromNumber) {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await sb.from("transfers").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("sender_phone", fromNumber).eq("is_deleted", false).gte("created_at", oneHourAgo);
    if ((count || 0) >= 10) { flags.push("high_velocity_sender"); score += 25; }
    else if ((count || 0) >= 5) { flags.push("moderate_velocity_sender"); score += 10; }
  }

  if (analysis.amount > 0) {
    if (analysis.amount >= 10000 && analysis.amount % 10000 === 0) { flags.push("very_round_amount"); score += 5; }
    const today = new Date().toISOString().split("T")[0];
    const { count: sameAmountCount } = await sb.from("transfers").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("amount", analysis.amount).eq("is_deleted", false).gte("created_at", today);
    if ((sameAmountCount || 0) >= 3) { flags.push("repeated_same_amount_today"); score += 15; }
  }

  if (analysis.date) {
    const transferDate = new Date(analysis.date);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (transferDate > tomorrow) { flags.push("future_date_detected"); score += 30; }
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (transferDate < thirtyDaysAgo) { flags.push("old_date_detected"); score += 15; }
  }

  if (analysis.confidence < 60) { flags.push("low_ai_confidence"); score += 10; }

  const mimeType = detectMimeType(buffer);
  if (mimeType === "image/jpeg" && buffer.length > 4) {
    const hasExif = buffer[2] === 0xFF && buffer[3] === 0xE1;
    if (!hasExif && sizeKB > 100) { flags.push("exif_stripped"); score += 5; }
  }

  return { score: Math.min(100, score), flags };
}

// ============ IMAGE DOWNLOAD ============
async function downloadImage(mediaUrl: string, accessToken?: string): Promise<{ buffer: Uint8Array; mimeType: string } | null> {
  try {
    let downloadUrl = mediaUrl;
    if (mediaUrl.startsWith("meta:")) {
      const mediaId = mediaUrl.slice(5);
      if (!mediaId || !/^[a-zA-Z0-9]+$/.test(mediaId)) return null;
      if (!accessToken) return null;
      const metaResp = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!metaResp.ok) return null;
      const metaData = await metaResp.json();
      downloadUrl = metaData.url;
      if (!downloadUrl) return null;
    }
    try { new URL(downloadUrl); } catch { return null; }
    const headers: Record<string, string> = {};
    if (mediaUrl.startsWith("meta:") && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) return null;
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > 10 * 1024 * 1024) return null;
    const buffer = new Uint8Array(arrayBuffer);
    return { buffer, mimeType: detectMimeType(buffer) };
  } catch { return null; }
}

// ============ STORAGE UPLOAD ============
async function uploadToStorage(sb: any, buffer: Uint8Array, mimeType: string, orgId: string): Promise<string | null> {
  try {
    const ext = mimeType.split("/")[1] || "jpeg";
    const fileName = `${orgId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from("receipts").upload(fileName, buffer, { contentType: mimeType, upsert: false });
    if (error) return null;
    return `storage:receipts/${fileName}`;
  } catch { return null; }
}

// ============ ENHANCED AI ANALYSIS ============
async function analyzeReceipt(imageBase64: string): Promise<{
  isReceipt: boolean; confidence: number; amount: number;
  date: string | null; sender: string | null; reference: string | null;
  transaction_id: string | null; receiver_account: string | null;
  sender_account: string | null; bank_comment: string | null;
} | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return null;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `حلل هذه الصورة لإشعار تحويل بنكي سوداني (خاصة بنك الخرطوم).
استخرج جميع المعلومات التالية:

1. هل هي صورة إشعار تحويل مالي؟
2. المبلغ (رقم فقط)
3. التاريخ (YYYY-MM-DD)
4. اسم المرسل
5. رقم العملية/المرجع (Reference/Transaction ID)
6. المستلم (Beneficiary / المحول إليه)
7. رقم حساب المرسل (From Account)
8. التعليق/الوصف/Remarks الموجود في الإشعار

أجب بصيغة JSON فقط:
{"isReceipt": true/false, "confidence": 0-100, "amount": number or 0, "date": "YYYY-MM-DD" or null, "sender": "string" or null, "reference": "string" or null, "transaction_id": "string" or null, "receiver_account": "string" or null, "sender_account": "string" or null, "bank_comment": "string" or null}`,
            },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) console.warn("AI rate limited (429)");
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    return {
      isReceipt: result.isReceipt === true,
      confidence: typeof result.confidence === "number" ? Math.min(100, Math.max(0, result.confidence)) : 0,
      amount: validateAndParseAmount(result.amount),
      date: result.date || null,
      sender: result.sender || null,
      reference: result.reference || result.transaction_id || null,
      transaction_id: result.transaction_id || result.reference || null,
      receiver_account: result.receiver_account || null,
      sender_account: result.sender_account || null,
      bank_comment: result.bank_comment || null,
    };
  } catch (error) {
    console.error("AI analysis error:", error);
    return null;
  }
}

// ============ SMART LINKING ENGINE ============
// Find recent text messages from same sender within time window to link as memo
async function findLinkedWhatsAppText(
  sb: any, orgId: string, fromNumber: string, imageMessageTime: string
): Promise<string | null> {
  try {
    const msgTime = new Date(imageMessageTime).getTime();
    const windowStart = new Date(msgTime - SMART_LINK_WINDOW_MS).toISOString();
    const windowEnd = new Date(msgTime + SMART_LINK_WINDOW_MS).toISOString();

    // Find text messages from the same sender in the time window
    const { data: textMessages } = await sb
      .from("whatsapp_messages")
      .select("content, created_at")
      .eq("organization_id", orgId)
      .eq("from_number", fromNumber)
      .in("message_type", ["textMessage", "extendedTextMessage", "text"])
      .gte("created_at", windowStart)
      .lte("created_at", windowEnd)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!textMessages || textMessages.length === 0) return null;

    // Filter out system content like "chatId:..." 
    const validTexts = textMessages
      .map((m: any) => m.content)
      .filter((c: string) => c && !c.startsWith("chatId:") && c.trim().length > 0);

    if (validTexts.length === 0) return null;

    // Return the most relevant text (closest to image time, max 500 chars)
    return validTexts[0].substring(0, 500);
  } catch (error) {
    console.error("Smart linking error:", error);
    return null;
  }
}

// Build the merged client_memo from WhatsApp text + bank comment
function buildClientMemo(whatsappText: string | null, bankComment: string | null): string | null {
  const parts = [whatsappText, bankComment].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" | ");
}

// ============ WHATSAPP CONFIRMATION REPLY ============
// Sends a free-form confirmation reply to the same WhatsApp thread that sent
// the receipt (Meta connections only, reply-in-thread, no template needed —
// we're always within the 24h customer-service window since this fires
// immediately after the inbound message). Fully isolated: any failure here
// is logged and swallowed, and NEVER changes the caller's return status.
async function sendConfirmationMessage(
  sb: any,
  connection: {
    id: string;
    organization_id: string;
    connection_type: string;
    meta_phone_number_id?: string | null;
    green_api_instance_id?: string | null;
    monitored_chat_id?: string | null;
    notification_enabled?: boolean;
  },
  credentials: { access_token?: string | null; green_api_token?: string | null } | null,
  transfer: { sender_phone: string | null | undefined; amount: number; sender_name: string | null; transfer_date: string; transaction_id?: string | null; bank_comment?: string | null },
  incomingChatId?: string | null
): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  let recipient: string | null = null;
  try {
    if (!connection.notification_enabled) return; // opt-in, off by default

    const formattedAmount = Number(transfer.amount || 0).toLocaleString("en-US");
    // Format date as DD/MM/YYYY for display
    let displayDate = transfer.transfer_date;
    if (/^\d{4}-\d{2}-\d{2}/.test(transfer.transfer_date)) {
      const [y, m, d] = transfer.transfer_date.slice(0, 10).split("-");
      displayDate = `${d}/${m}/${y}`;
    }
    const lines = [
      `✅ *تم تسجيل الإيصال بنجاح*`,
      `━━━━━━━━━━━━━━`,
      `💰 *المبلغ:* ${formattedAmount} ج.س`,
      `👤 *المرسل:* ${transfer.sender_name || "غير معروف"}`,
      `📅 *التاريخ:* ${displayDate}`,
    ];
    if (transfer.transaction_id) {
      lines.push(`🔖 *رقم العملية:* ${String(transfer.transaction_id).substring(0, 60)}`);
    }
    if (transfer.bank_comment) {
      lines.push(`📝 *الملاحظة:* ${String(transfer.bank_comment).substring(0, 120)}`);
    }
    lines.push(`━━━━━━━━━━━━━━`, `_تم التحليل تلقائيًا عبر النظام_`);
    const body = lines.join("\n");

    let resp: Response;

    if (connection.connection_type === "meta") {
      if (!connection.meta_phone_number_id || !credentials?.access_token) return;
      if (!transfer.sender_phone) return;
      recipient = transfer.sender_phone;
      resp = await fetch(`https://graph.facebook.com/v18.0/${connection.meta_phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body },
        }),
        signal: ctrl.signal,
      });
    } else if (connection.connection_type === "green_api") {
      if (!connection.green_api_instance_id || !credentials?.green_api_token) return;
      // Prefer the actual incoming chatId (correctly targets groups); fall back
      // to monitored group, then to a 1-to-1 chat derived from sender_phone.
      let chatId = incomingChatId || connection.monitored_chat_id || null;
      if (!chatId && transfer.sender_phone) {
        const raw = String(transfer.sender_phone);
        chatId = raw.includes("@") ? raw : `${raw}@c.us`;
      }
      if (!chatId) return;
      recipient = chatId;
      const url = `https://api.green-api.com/waInstance${connection.green_api_instance_id}/sendMessage/${credentials.green_api_token}`;
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: body }),
        signal: ctrl.signal,
      });
    } else {
      return; // unknown connection type
    }

    let errorDetail: string | null = null;
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      errorDetail = `[${connection.connection_type}] ${errText}`.substring(0, 500);
    }

    await sb.from("whatsapp_notification_log").insert({
      connection_id: connection.id,
      organization_id: connection.organization_id,
      recipient_phone: recipient ? recipient.substring(0, 50) : null,
      status: resp.ok ? "sent" : "failed",
      error_message: errorDetail,
    });
  } catch (err) {
    try {
      await sb.from("whatsapp_notification_log").insert({
        connection_id: connection.id,
        organization_id: connection.organization_id,
        recipient_phone: recipient ? recipient.substring(0, 50) : (transfer.sender_phone ? String(transfer.sender_phone).substring(0, 50) : null),
        status: "failed",
        error_message: `[${connection.connection_type}] ${String((err as Error)?.message || err)}`.substring(0, 500),
      });
    } catch {
      // Logging itself must never throw — swallow silently.
    }
  } finally {
    clearTimeout(timer);
  }
}

// Sends a short warning back to the same chat when we detect a duplicate
// receipt (same image hash or same transaction_id). Always fires regardless
// of notification_enabled — this is a merchant-protection safeguard, not an
// opt-in courtesy message. Fully isolated: never throws to the caller.
async function sendDuplicateAlert(
  sb: any,
  connection: {
    id: string;
    organization_id: string;
    connection_type: string;
    meta_phone_number_id?: string | null;
    green_api_instance_id?: string | null;
    monitored_chat_id?: string | null;
  },
  credentials: { access_token?: string | null; green_api_token?: string | null } | null,
  senderPhone: string | null | undefined,
  incomingChatId: string | null,
  reason: "duplicate_image" | "duplicate_transaction",
  extra?: { transaction_id?: string | null }
): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  let recipient: string | null = null;
  try {
    const lines = [
      `⚠️ *عذراً، هذا الإشعار تم تسجيله مسبقاً*`,
      `━━━━━━━━━━━━━━`,
      reason === "duplicate_image"
        ? `تم اكتشاف نفس صورة الإيصال في سجلاتنا.`
        : `تم اكتشاف نفس رقم العملية في سجلاتنا.`,
    ];
    if (extra?.transaction_id) {
      lines.push(`🔖 *رقم العملية:* ${String(extra.transaction_id).substring(0, 60)}`);
    }
    lines.push(
      `لا يمكن قبول نفس الإيصال مرتين — هذه حماية تلقائية لأموال التاجر.`,
      `━━━━━━━━━━━━━━`,
      `_في حال كان هذا خطأ، يرجى التواصل مع الإدارة._`
    );
    const body = lines.join("\n");

    let resp: Response;
    if (connection.connection_type === "meta") {
      if (!connection.meta_phone_number_id || !credentials?.access_token || !senderPhone) return;
      recipient = senderPhone;
      resp = await fetch(`https://graph.facebook.com/v18.0/${connection.meta_phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: recipient, type: "text", text: { body } }),
        signal: ctrl.signal,
      });
    } else if (connection.connection_type === "green_api") {
      if (!connection.green_api_instance_id || !credentials?.green_api_token) return;
      let chatId = incomingChatId || connection.monitored_chat_id || null;
      if (!chatId && senderPhone) {
        const raw = String(senderPhone);
        chatId = raw.includes("@") ? raw : `${raw}@c.us`;
      }
      if (!chatId) return;
      recipient = chatId;
      const url = `https://api.green-api.com/waInstance${connection.green_api_instance_id}/sendMessage/${credentials.green_api_token}`;
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, message: body }),
        signal: ctrl.signal,
      });
    } else {
      return;
    }

    let errorDetail: string | null = null;
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      errorDetail = `[dup:${reason}][${connection.connection_type}] ${errText}`.substring(0, 500);
    }
    await sb.from("whatsapp_notification_log").insert({
      connection_id: connection.id,
      organization_id: connection.organization_id,
      recipient_phone: recipient ? recipient.substring(0, 50) : null,
      status: resp.ok ? "sent" : "failed",
      error_message: errorDetail ?? `duplicate_alert:${reason}`,
    });
  } catch (err) {
    try {
      await sb.from("whatsapp_notification_log").insert({
        connection_id: connection.id,
        organization_id: connection.organization_id,
        recipient_phone: recipient ? recipient.substring(0, 50) : (senderPhone ? String(senderPhone).substring(0, 50) : null),
        status: "failed",
        error_message: `[dup:${reason}][${connection.connection_type}] ${String((err as Error)?.message || err)}`.substring(0, 500),
      });
    } catch { /* swallow */ }
  } finally {
    clearTimeout(timer);
  }
}

// ============ PROCESS SINGLE MESSAGE ============
async function processMessage(sb: any, msg: any): Promise<{ status: string; messageId: string }> {
  const messageId = msg.message_id;

  try {
    const { data: connection } = await sb
      .from("whatsapp_connections")
      .select("id, branch_id, organization_id, connection_type, monitored_chat_id, meta_phone_number_id, green_api_instance_id, notification_enabled")
      .eq("id", msg.whatsapp_connection_id)
      .single();

    if (!connection) {
      await sb.from("whatsapp_messages").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", msg.id);
      return { status: "no_connection", messageId };
    }

    // Fetch access token + green_api_token from credentials table
    const { data: creds } = await sb
      .from("whatsapp_credentials")
      .select("access_token, green_api_token")
      .eq("connection_id", connection.id)
      .single();

    // Download image
    const imageData = await downloadImage(msg.media_url, creds?.access_token || null);
    if (!imageData) {
      await sb.from("failed_jobs").insert({
        job_type: "image_download",
        payload: { messageId: msg.id, mediaUrl: msg.media_url, connectionId: connection.id },
        error_message: "Image download failed",
        organization_id: connection.organization_id,
        whatsapp_message_id: messageId,
        next_retry_at: new Date(Date.now() + 30000).toISOString(),
      });
      return { status: "download_failed", messageId };
    }

    // Compute hash & check duplicates
    const imageHash = await computeImageHash(imageData.buffer);
    const { data: dupImg } = await sb.from("transfers").select("id").eq("image_hash", imageHash).eq("organization_id", connection.organization_id).eq("is_deleted", false).limit(1);
    if (dupImg && dupImg.length > 0) {
      await sb.from("whatsapp_messages").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", msg.id);
      const dupChatId = msg.chat_id || msg.content?.match?.(/chatId:([^\s]+)/)?.[1] || null;
      await sendDuplicateAlert(sb, connection, creds || null, msg.from_number, dupChatId, "duplicate_image");
      return { status: "duplicate_image", messageId };
    }

    // Upload to storage
    const publicUrl = await uploadToStorage(sb, imageData.buffer, imageData.mimeType, connection.organization_id);

    // AI Analysis (enhanced)
    const imageBase64 = bufferToBase64DataUrl(imageData.buffer, imageData.mimeType);
    const analysis = await analyzeReceipt(imageBase64);

    if (!analysis) {
      await sb.from("failed_jobs").insert({
        job_type: "ai_analysis",
        payload: { messageId: msg.id, connectionId: connection.id, branchId: connection.branch_id, orgId: connection.organization_id, fromNumber: msg.from_number, storageUrl: publicUrl, imageHash },
        error_message: "AI analysis failed",
        organization_id: connection.organization_id,
        whatsapp_message_id: messageId,
        next_retry_at: new Date(Date.now() + 60000).toISOString(),
      });
      return { status: "ai_failed", messageId };
    }

    // Mark message as processed
    await sb.from("whatsapp_messages").update({
      processed: true,
      processed_at: new Date().toISOString(),
      media_url: publicUrl || msg.media_url,
    }).eq("id", msg.id);

    // ❌ Reject non-receipts or very low confidence
    if (!analysis.isReceipt || analysis.confidence < 50 || analysis.amount <= 0) {
      await sb.from("system_logs").insert({
        level: "info", source: "decision-engine",
        message: `Rejected: confidence=${analysis.confidence}, isReceipt=${analysis.isReceipt}, amount=${analysis.amount}`,
        metadata: { messageId: msg.id, analysis, decision: "rejected" },
        organization_id: connection.organization_id,
        connection_id: connection.id,
      });
      return { status: "not_receipt", messageId };
    }

    // 🔗 Check duplicate transaction_id
    const txId = analysis.transaction_id || analysis.reference;
    if (txId) {
      const { data: dupTx } = await sb.from("transfers")
        .select("id")
        .eq("organization_id", connection.organization_id)
        .eq("transaction_id", txId)
        .eq("is_deleted", false)
        .limit(1);
      if (dupTx && dupTx.length > 0) {
        await sb.from("system_logs").insert({
          level: "warn", source: "duplicate-engine",
          message: `Duplicate transaction_id: ${txId}`,
          metadata: { messageId: msg.id, transaction_id: txId, existingTransferId: dupTx[0].id },
          organization_id: connection.organization_id,
          connection_id: connection.id,
        });
        const dupChatId = msg.chat_id || msg.content?.match?.(/chatId:([^\s]+)/)?.[1] || null;
        await sendDuplicateAlert(sb, connection, creds || null, msg.from_number, dupChatId, "duplicate_transaction", { transaction_id: String(txId) });
        return { status: "duplicate_transaction", messageId };
      }
    }

    // 🔗 SMART LINKING: Find WhatsApp text message within 10-minute window
    const whatsappText = await findLinkedWhatsAppText(
      sb, connection.organization_id, msg.from_number, msg.created_at
    );

    // Build merged client_memo
    const clientMemo = buildClientMemo(whatsappText, analysis.bank_comment);

    // 🛡️ FRAUD DETECTION
    const fraud = await detectFraud(sb, imageData.buffer, imageHash, analysis, connection.organization_id, msg.from_number);

    const fraudForceReview = fraud.score >= 70;
    const needsReview = analysis.confidence < 80 || fraudForceReview || !clientMemo;
    const validatedDate = isValidDate(analysis.date) ? analysis.date : new Date().toISOString().split("T")[0];

    // 🧠 SMART ROUTING - prefer dedicated chat_id column, fall back to legacy content parsing
    let targetBranchId = connection.branch_id;
    const chatId = msg.chat_id || msg.content?.match?.(/chatId:([^\s]+)/)?.[1] || msg.from_number;
    if (chatId) {
      const { data: chatBranch } = await sb.from("branches")
        .select("id")
        .eq("organization_id", connection.organization_id)
        .eq("whatsapp_chat_id", chatId)
        .eq("is_deleted", false).eq("is_active", true)
        .limit(1).maybeSingle();
      if (chatBranch) targetBranchId = chatBranch.id;
    }

    const { data: insertedTransfer, error: transferError } = await sb.from("transfers").insert({
      branch_id: targetBranchId,
      organization_id: connection.organization_id,
      whatsapp_connection_id: connection.id,
      sender_phone: msg.from_number?.substring(0, 50),
      amount: analysis.amount,
      transfer_date: validatedDate,
      sender_name: analysis.sender ? String(analysis.sender).substring(0, 255) : null,
      transaction_id: txId ? String(txId).substring(0, 100) : null,
      receiver_account: analysis.receiver_account ? String(analysis.receiver_account).substring(0, 255) : null,
      sender_account: analysis.sender_account ? String(analysis.sender_account).substring(0, 100) : null,
      bank_comment: analysis.bank_comment ? String(analysis.bank_comment).substring(0, 1000) : null,
      client_memo: clientMemo ? String(clientMemo).substring(0, 2000) : null,
      is_manual_memo: false,
      notes: analysis.reference ? `Reference: ${String(analysis.reference).substring(0, 255)}` : null,
      extracted_data: { ...analysis, whatsapp_linked_text: whatsappText },
      image_url: publicUrl,
      image_hash: imageHash,
      needs_review: needsReview,
      ai_confidence: analysis.confidence,
      is_confirmed: !needsReview,
      confirmed_at: !needsReview ? new Date().toISOString() : null,
      fraud_score: fraud.score,
      fraud_flags: fraud.flags,
    }).select("id").single();

    // POS auto-match: try matching a pending POS invoice by amount within ±15 minutes
    if (!needsReview && insertedTransfer?.id) {
      try {
        const { data: matchedInvoiceId } = await sb.rpc("match_pending_pos_invoice", {
          _org: connection.organization_id,
          _amount: analysis.amount,
          _timestamp: validatedDate ? new Date(validatedDate).toISOString() : new Date().toISOString(),
          _transfer_id: insertedTransfer.id,
          _bank_ref: txId || null,
        });
        if (matchedInvoiceId) {
          await sb.from("system_logs").insert({
            level: "info", source: "pos-matcher",
            message: `✅ POS invoice ${matchedInvoiceId} matched with transfer ${insertedTransfer.id}`,
            metadata: { transfer_id: insertedTransfer.id, invoice_id: matchedInvoiceId, amount: analysis.amount },
            organization_id: connection.organization_id,
          });
        }
      } catch (e) {
        console.warn("POS auto-match failed:", e);
      }
    }

    await sb.from("system_logs").insert({
      level: fraud.score >= 50 ? "warn" : "info",
      source: "decision-engine",
      message: `${fraudForceReview ? "⚠️ Fraud flagged" : needsReview ? "Needs review" : "Auto-approved"}: confidence=${analysis.confidence}, amount=${analysis.amount}, fraud=${fraud.score}, linked=${!!whatsappText}`,
      metadata: { messageId: msg.id, analysis, fraud, decision: needsReview ? "pending_review" : "auto_approved", imageHash, whatsappLinked: !!whatsappText, transaction_id: txId },
      organization_id: connection.organization_id,
      connection_id: connection.id,
    });

    if (transferError) {
      console.error("Transfer insert error:", transferError);
      // Unique-violation handling (idempotency for retries)
      const errMsg = String(transferError.message || "");
      const errCode = (transferError as any).code;
      if (errCode === "23505" || errMsg.includes("idx_transfers_transaction_id_unique")) {
        return { status: "duplicate_transaction", messageId };
      }
      if (errMsg.includes("idx_transfers_image_hash")) {
        return { status: "duplicate_image", messageId };
      }
      await sb.from("failed_jobs").insert({
        job_type: "transfer_insert",
        payload: { branchId: connection.branch_id, orgId: connection.organization_id, amount: analysis.amount, date: validatedDate, messageId: msg.id },
        error_message: transferError.message,
        organization_id: connection.organization_id,
        whatsapp_message_id: messageId,
      });
      return { status: "transfer_failed", messageId };
    }

    // Awaited so the send actually completes before this Edge Function
    // instance returns (Deno may suspend background work otherwise),
    // but fully isolated: any failure inside is caught and logged there,
    // and never changes this function's return value below.
    // Reuse chatId already parsed above for smart routing; strip the WA suffix
    // for Meta (which needs a plain phone number), keep it for Green API.
    const incomingChatId = msg.chat_id || msg.content?.match?.(/chatId:([^\s]+)/)?.[1] || null;
    await sendConfirmationMessage(
      sb,
      connection,
      creds || null,
      {
        sender_phone: msg.from_number,
        amount: analysis.amount,
        sender_name: analysis.sender ? String(analysis.sender) : null,
        transfer_date: validatedDate,
        transaction_id: txId ? String(txId) : null,
        bank_comment: analysis.bank_comment ? String(analysis.bank_comment) : null,
      },
      incomingChatId
    );

    return { status: "success", messageId };
  } catch (error) {
    console.error(`Error processing ${messageId}:`, error);
    return { status: "error", messageId };
  }
}

// ============ MAIN: BATCH PROCESSOR ============
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Service-role-only: this function is an internal pipeline trigger.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const presented = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!serviceKey || presented !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

  try {
    const { data: messages, error } = await sb
      .from("whatsapp_messages")
      .select("*")
      .eq("processed", false)
      .in("message_type", ["image", "imageMessage"])
      .order("created_at", { ascending: true })
      .limit(MAX_CONCURRENT * 2);

    if (error) throw error;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ status: "no_pending", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { status: string; messageId: string }[] = [];

    for (let i = 0; i < messages.length; i += MAX_CONCURRENT) {
      const batch = messages.slice(i, i + MAX_CONCURRENT);

      const batchResults = await Promise.allSettled(
        batch.map((msg, idx) =>
          new Promise<{ status: string; messageId: string }>((resolve) => {
            setTimeout(async () => {
              const result = await processMessage(sb, msg);
              resolve(result);
            }, idx * AI_RATE_LIMIT_DELAY);
          })
        )
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
        else results.push({ status: "error", messageId: "unknown" });
      }

      if (i + MAX_CONCURRENT < messages.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    const success = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => ["ai_failed", "download_failed", "transfer_failed", "error"].includes(r.status)).length;
    const duplicates = results.filter(r => r.status === "duplicate_transaction").length;

    console.log(`Processed ${results.length} messages: ${success} success, ${failed} failed, ${duplicates} duplicates`);

    return new Response(JSON.stringify({
      status: "completed",
      total: results.length,
      success,
      failed,
      duplicates,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Process receipt error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
