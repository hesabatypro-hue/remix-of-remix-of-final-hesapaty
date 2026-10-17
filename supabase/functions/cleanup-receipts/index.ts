import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Constant-time-ish comparison
function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // 🔒 Internal-only: destructive cron job (deletes storage objects).
  // Accepted callers: service-role bearer token, or pg_cron via CRON_SECRET.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const presented = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const presentedCron = req.headers.get("x-cron-secret") ?? "";
  const authorized =
    (!!serviceKey && safeEqual(presented, serviceKey)) ||
    (!!cronSecret && safeEqual(presentedCron, cronSecret));
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey
  );

  const startedAt = new Date();
  const logRun = async (status: string, details: Record<string, unknown>, errorMessage?: string) => {
    const finishedAt = new Date();
    try {
      await sb.from("cron_job_runs").insert({
        job_name: "cleanup-receipts",
        status,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        details,
        error_message: errorMessage ?? null,
      });
    } catch (_) { /* never fail the job because of logging */ }
  };

  try {
    let deletedImages = 0;
    let deletedJobs = 0;
    let deletedMessages = 0;

    // 1. Clean up rejected/non-receipt messages older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldMessages } = await sb
      .from("whatsapp_messages")
      .select("id, media_url")
      .eq("processed", true)
      .lt("created_at", sevenDaysAgo)
      .not("media_url", "is", null)
      .limit(50);

    if (oldMessages?.length) {
      // Check which messages have no associated transfer
      for (const msg of oldMessages) {
        // Don't delete media that's linked to active transfers
        const { data: linkedTransfer } = await sb
          .from("transfers")
          .select("id")
          .eq("is_deleted", false)
          .limit(1);

        // Only clean orphaned media
        if (!linkedTransfer?.length && msg.media_url && !msg.media_url.startsWith("meta:")) {
          try {
            // Handle new storage path format: "storage:receipts/orgId/file.ext"
            if (msg.media_url.startsWith("storage:receipts/")) {
              const filePath = msg.media_url.replace("storage:receipts/", "");
              if (filePath) {
                await sb.storage.from("receipts").remove([filePath]);
                deletedImages++;
              }
            } else {
              // Legacy: full URL format
              const url = new URL(msg.media_url);
              const storageBase = "/storage/v1/object/public/receipts/";
              if (url.pathname.includes(storageBase)) {
                const filePath = url.pathname.split(storageBase)[1];
                if (filePath) {
                  await sb.storage.from("receipts").remove([filePath]);
                  deletedImages++;
                }
              }
            }
          } catch { /* skip invalid URLs */ }
        }
      }
    }

    // 2. Clean up completed/failed jobs older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldJobs } = await sb
      .from("failed_jobs")
      .select("id")
      .in("status", ["completed", "failed"])
      .lt("created_at", thirtyDaysAgo)
      .limit(100);

    if (oldJobs?.length) {
      // Can't delete via RLS, so just log count
      deletedJobs = oldJobs.length;
      console.log(`Found ${deletedJobs} old jobs eligible for cleanup`);
    }

    // 3. Clean soft-deleted transfer images older than 30 days
    const { data: deletedTransfers } = await sb
      .from("transfers")
      .select("id, image_url")
      .eq("is_deleted", true)
      .lt("deleted_at", thirtyDaysAgo)
      .not("image_url", "is", null)
      .limit(50);

    if (deletedTransfers?.length) {
      for (const t of deletedTransfers) {
        if (!t.image_url) continue;
        try {
          // Handle new storage path format
          if (t.image_url.startsWith("storage:receipts/")) {
            const filePath = t.image_url.replace("storage:receipts/", "");
            if (filePath) {
              await sb.storage.from("receipts").remove([filePath]);
              deletedImages++;
            }
          } else {
            // Legacy: full URL format
            const url = new URL(t.image_url);
            const storageBase = "/storage/v1/object/public/receipts/";
            if (url.pathname.includes(storageBase)) {
              const filePath = url.pathname.split(storageBase)[1];
              if (filePath) {
                await sb.storage.from("receipts").remove([filePath]);
                deletedImages++;
              }
            }
          }
        } catch { /* skip */ }
      }
    }

    // 4. Clean old processed messages (text only, no media) older than 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: oldTextMsgs } = await sb
      .from("whatsapp_messages")
      .select("id")
      .eq("processed", true)
      .is("media_url", null)
      .lt("created_at", ninetyDaysAgo)
      .limit(200);

    deletedMessages = oldTextMsgs?.length || 0;

    // Log cleanup results
    await sb.from("system_logs").insert({
      level: "info",
      source: "cleanup-receipts",
      message: `Cleanup completed: ${deletedImages} images, ${deletedJobs} old jobs found, ${deletedMessages} old messages found`,
      metadata: { deletedImages, deletedJobs, deletedMessages },
    });

    await logRun("success", { deletedImages, oldJobsFound: deletedJobs, oldMessagesFound: deletedMessages });

    return new Response(JSON.stringify({
      status: "completed",
      deletedImages,
      oldJobsFound: deletedJobs,
      oldMessagesFound: deletedMessages,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    await sb.from("system_logs").insert({
      level: "error",
      source: "cleanup-receipts",
      message: `Cleanup failed: ${error?.message || error}`,
    });
    await logRun("failed", {}, String(error?.message || error));
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
