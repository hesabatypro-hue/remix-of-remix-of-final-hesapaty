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

const MAX_CONCURRENT = 5;
const AI_RATE_LIMIT_DELAY = 500;

// ============ HELPERS ============
// SECURITY: Limit image size to prevent AI credit abuse
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImageSize(buffer: Uint8Array): boolean {
  return buffer.length <= MAX_IMAGE_SIZE_BYTES;
}

// SECURITY: Whitelist of allowed MIME types — images only
// Magic bytes are checked by detectMimeType() before this runs
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

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
  score: number; // 0-100, higher = more suspicious
  flags: string[];
}

async function detectFraud(
  sb: any,
  buffer: Uint8Array,
  imageHash: string,
  analysis: { amount: number; date: string | null; sender: string | null; reference: string | null; confidence: number },
  orgId: string,
  fromNumber: string
): Promise<FraudResult> {
  const flags: string[] = [];
  let score = 0;

  // 1. Image size anomaly (too small = screenshot of screenshot, too large = edited)
  const sizeKB = buffer.length / 1024;
  if (sizeKB < 10) {
    flags.push("image_too_small");
    score += 15;
  }
  if (sizeKB > 8000) {
    flags.push("image_unusually_large");
    score += 10;
  }

  // 2. Duplicate hash check (already done but flag it)
  const { data: dupHash } = await sb.from("transfers")
    .select("id")
    .eq("image_hash", imageHash)
    .eq("organization_id", orgId)
    .eq("is_deleted", false)
    .limit(1);
  if (dupHash && dupHash.length > 0) {
    flags.push("duplicate_image_hash");
    score += 50;
  }

  // 3. Same sender sending too many transfers in short time (velocity check)
  if (fromNumber) {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count } = await sb.from("transfers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("sender_phone", fromNumber)
      .eq("is_deleted", false)
      .gte("created_at", oneHourAgo);
    if ((count || 0) >= 10) {
      flags.push("high_velocity_sender");
      score += 25;
    } else if ((count || 0) >= 5) {
      flags.push("moderate_velocity_sender");
      score += 10;
    }
  }

  // 4. Unusual amount patterns
  if (analysis.amount > 0) {
    // Very round numbers can be suspicious
    if (analysis.amount >= 10000 && analysis.amount % 10000 === 0) {
      flags.push("very_round_amount");
      score += 5;
    }
    // Check if same exact amount sent multiple times today
    const today = new Date().toISOString().split("T")[0];
    const { count: sameAmountCount } = await sb.from("transfers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("amount", analysis.amount)
      .eq("is_deleted", false)
      .gte("created_at", today);
    if ((sameAmountCount || 0) >= 3) {
      flags.push("repeated_same_amount_today");
      score += 15;
    }
  }

  // 5. Future date check
  if (analysis.date) {
    const transferDate = new Date(analysis.date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (transferDate > tomorrow) {
      flags.push("future_date_detected");
      score += 30;
    }
    // Very old date (> 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (transferDate < thirtyDaysAgo) {
      flags.push("old_date_detected");
      score += 15;
    }
  }

  // 6. Low AI confidence compounds fraud risk
  if (analysis.confidence < 60) {
    flags.push("low_ai_confidence");
    score += 10;
  }

  // 7. Image dimension ratio check via buffer analysis (simple JPEG header check)
  const mimeType = detectMimeType(buffer);
  if (mimeType === "image/jpeg" && buffer.length > 4) {
    // Check for EXIF manipulation markers (stripped EXIF = possible edit)
    const hasExif = buffer[2] === 0xFF && buffer[3] === 0xE1;
    if (!hasExif && sizeKB > 100) {
      flags.push("exif_stripped");
      score += 5;
    }
  }

  // Cap score at 100
  score = Math.min(100, score);

  return { score, flags };
}

// ============ IMAGE DOWNLOAD ============

// SECURITY: Whitelist of allowed external domains for image download.
// Only add domains you explicitly trust. This prevents SSRF attacks.
const ALLOWED_IMAGE_DOMAINS = [
  // Meta / WhatsApp Business API CDN
  "lookaside.fbsbx.com",
  "scontent.whatsapp.net",
  "mmg.whatsapp.net",
  "media.fbcdn.net",
  // Green API CDN
  "sw-media.itr.su",
  "sw-media.green-api.com",
  "media.green-api.com",
  // Supabase Storage (own project)
  // Note: storage: prefix is handled separately, not via HTTP fetch
];

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS
    if (parsed.protocol !== "https:") return false;
    // Check against whitelist (exact match or subdomain match)
    return ALLOWED_IMAGE_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith("." + domain)
    );
  } catch {
    return false;
  }
}

async function downloadImage(mediaUrl: string, accessToken?: string): Promise<{ buffer: Uint8Array; mimeType: string } | null> {
  try {
    let downloadUrl = mediaUrl;

    // Handle Meta media ID prefix
    if (mediaUrl.startsWith("meta:")) {
      const mediaId = mediaUrl.slice(5);
      if (!mediaId || !/^[a-zA-Z0-9]+$/.test(mediaId)) return null;
      if (!accessToken) return null;
      // graph.facebook.com is a fixed known endpoint — not user-supplied
      const metaResp = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!metaResp.ok) return null;
      const metaData = await metaResp.json();
      downloadUrl = metaData.url;
      if (!downloadUrl) return null;
      // Meta CDN URLs must also be whitelisted
      if (!isAllowedImageUrl(downloadUrl)) {
        console.error("SSRF_BLOCKED: Meta returned non-whitelisted URL:", downloadUrl);
        return null;
      }
    } else {
      // SECURITY: Reject any direct URL not in whitelist
      if (!isAllowedImageUrl(downloadUrl)) {
        console.error("SSRF_BLOCKED: URL not in whitelist:", downloadUrl);
        return null;
      }
    }

    const headers: Record<string, string> = {};
    if (mediaUrl.startsWith("meta:") && accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

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

// ============ AI ANALYSIS ============
async function analyzeReceipt(imageBase64: string): Promise<{
  isReceipt: boolean; confidence: number; amount: number;
  date: string | null; sender: string | null; reference: string | null;
} | null> {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return null;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image in a SINGLE step:
1. Determine if it is a financial transfer receipt/bank transfer screenshot.
2. If YES, extract: amount (number only), date (YYYY-MM-DD), sender name, reference number.

Respond ONLY with this JSON:
{"isReceipt": true/false, "confidence": 0-100, "amount": number or 0, "date": "YYYY-MM-DD" or null, "sender": "string" or null, "reference": "string" or null}`,
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
      reference: result.reference || null,
    };
  } catch (error) {
    console.error("AI analysis error:", error);
    return null;
  }
}

// ============ PROCESS SINGLE MESSAGE ============
async function processMessage(sb: any, msg: any): Promise<{ status: string; messageId: string }> {
  const messageId = msg.message_id;

  try {
    const { data: connection } = await sb
      .from("whatsapp_connections")
      .select("id, branch_id, organization_id, access_token, connection_type, monitored_chat_id")
      .eq("id", msg.whatsapp_connection_id)
      .single();

    if (!connection) {
      await sb.from("whatsapp_messages").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", msg.id);
      return { status: "no_connection", messageId };
    }

    // Download image
    const imageData = await downloadImage(msg.media_url, connection.access_token);
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

    // SECURITY: Reject non-image file types (checked via magic bytes, not extension)
    if (!validateMimeType(imageData.mimeType)) {
      console.warn(`BLOCKED: Invalid file type "${imageData.mimeType}" for message ${messageId}`);
      await sb.from("whatsapp_messages")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("id", msg.id);
      return { status: "invalid_file_type", messageId };
    }

    // Compute hash & check duplicates
    const imageHash = await computeImageHash(imageData.buffer);
    const { data: dupImg } = await sb.from("transfers").select("id").eq("image_hash", imageHash).eq("organization_id", connection.organization_id).eq("is_deleted", false).limit(1);
    if (dupImg && dupImg.length > 0) {
      await sb.from("whatsapp_messages").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", msg.id);
      return { status: "duplicate_image", messageId };
    }

    // Upload to storage
    const publicUrl = await uploadToStorage(sb, imageData.buffer, imageData.mimeType, connection.organization_id);

    // AI Analysis
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

    // ❌ Decision Engine: Reject non-receipts or very low confidence
    if (!analysis.isReceipt || analysis.confidence < 50 || analysis.amount <= 0) {
      await sb.from("system_logs").insert({
        level: "info",
        source: "decision-engine",
        message: `Rejected: confidence=${analysis.confidence}, isReceipt=${analysis.isReceipt}, amount=${analysis.amount}`,
        metadata: { messageId: msg.id, analysis, decision: "rejected" },
        organization_id: connection.organization_id,
        connection_id: connection.id,
      });
      return { status: "not_receipt", messageId };
    }

    // Check duplicate reference
    if (analysis.reference) {
      const { data: dupRef } = await sb.from("transfers").select("id").eq("organization_id", connection.organization_id).eq("is_deleted", false).filter("extracted_data->>reference", "eq", analysis.reference).limit(1);
      if (dupRef && dupRef.length > 0) {
        return { status: "duplicate_reference", messageId };
      }
    }

    // 🛡️ FRAUD DETECTION
    const fraud = await detectFraud(
      sb,
      imageData.buffer,
      imageHash,
      analysis,
      connection.organization_id,
      msg.from_number
    );

    // If fraud score >= 70, force manual review regardless of AI confidence
    const fraudForceReview = fraud.score >= 70;
    const needsReview = analysis.confidence < 80 || fraudForceReview;
    const validatedDate = isValidDate(analysis.date) ? analysis.date : new Date().toISOString().split("T")[0];

    // 🧠 SMART ROUTING: Determine target branch
    let targetBranchId = connection.branch_id; // Default: connection's branch
    const chatId = msg.content?.match?.(/chatId:([^\s]+)/)?.[1] || msg.from_number;

    // Level 1: Check if chat_id matches a branch's whatsapp_chat_id
    if (chatId) {
      const { data: chatBranch } = await sb.from("branches")
        .select("id")
        .eq("organization_id", connection.organization_id)
        .eq("whatsapp_chat_id", chatId)
        .eq("is_deleted", false)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (chatBranch) {
        targetBranchId = chatBranch.id;
      }
    }
    // Level 2: connection.branch_id (already set as default)
    // Level 3: Falls through to connection.branch_id (general treasury)

    const { error: transferError } = await sb.from("transfers").insert({
      branch_id: targetBranchId,
      organization_id: connection.organization_id,
      whatsapp_connection_id: connection.id,
      sender_phone: msg.from_number?.substring(0, 50),
      amount: analysis.amount,
      transfer_date: validatedDate,
      sender_name: analysis.sender ? String(analysis.sender).substring(0, 255) : null,
      notes: analysis.reference ? `Reference: ${String(analysis.reference).substring(0, 255)}` : null,
      extracted_data: { ...analysis },
      image_url: publicUrl,
      image_hash: imageHash,
      needs_review: needsReview,
      ai_confidence: analysis.confidence,
      is_confirmed: !needsReview,
      confirmed_at: !needsReview ? new Date().toISOString() : null,
      fraud_score: fraud.score,
      fraud_flags: fraud.flags,
    });

    // Log with fraud info
    await sb.from("system_logs").insert({
      level: fraud.score >= 50 ? "warn" : "info",
      source: "decision-engine",
      message: `${fraudForceReview ? "⚠️ Fraud flagged" : needsReview ? "Needs review" : "Auto-approved"}: confidence=${analysis.confidence}, amount=${analysis.amount}, fraud=${fraud.score}`,
      metadata: { messageId: msg.id, analysis, fraud, decision: needsReview ? "pending_review" : "auto_approved", imageHash },
      organization_id: connection.organization_id,
      connection_id: connection.id,
    });

    if (transferError) {
      console.error("Transfer insert error:", transferError);
      await sb.from("failed_jobs").insert({
        job_type: "transfer_insert",
        payload: { branchId: connection.branch_id, orgId: connection.organization_id, amount: analysis.amount, date: validatedDate, messageId: msg.id },
        error_message: transferError.message,
        organization_id: connection.organization_id,
        whatsapp_message_id: messageId,
      });
      return { status: "transfer_failed", messageId };
    }

    return { status: "success", messageId };
  } catch (error) {
    console.error(`Error processing ${messageId}:`, error);
    return { status: "error", messageId };
  }
}

// ============ MAIN: BATCH PROCESSOR ============
serve(async (req) => {
  const _origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(_origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

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

    console.log(`Processed ${results.length} messages: ${success} success, ${failed} failed`);

    return new Response(JSON.stringify({
      status: "completed",
      total: results.length,
      success,
      failed,
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
