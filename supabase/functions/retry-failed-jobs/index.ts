import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 🔒 Service-role-only: this is an internal cron/pipeline trigger, not a
  // user-facing endpoint. Without this check, anyone who knows the public
  // Edge Function URL could invoke it directly (Supabase function URLs are
  // publicly reachable by design). Mirrors the same gate already used in
  // process-receipt.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const presented = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!serviceKey || presented !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey
    );

    // Get pending jobs that are ready for retry
    const { data: jobs, error } = await supabaseClient
      .from("failed_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .lt("attempts", 3)
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ status: "no_pending_jobs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      // Mark as processing
      await supabaseClient.from("failed_jobs").update({
        status: "processing",
        last_attempted_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      }).eq("id", job.id);

      try {
        const p = job.payload as any;

        if (job.job_type === "transfer_insert") {
          const { error: insertError } = await supabaseClient.from("transfers").insert({
            branch_id: p.branchId,
            organization_id: p.orgId,
            amount: p.amount,
            transfer_date: p.date,
          });
          if (insertError) throw insertError;

        } else if (job.job_type === "image_download" || job.job_type === "ai_analysis") {
          // Re-trigger process-receipt which will pick up unprocessed messages
          const supabaseUrl = Deno.env.get("SUPABASE_URL");
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
          if (supabaseUrl && serviceKey) {
            const resp = await fetch(`${supabaseUrl}/functions/v1/process-receipt`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ trigger: "retry-worker", jobId: job.id }),
            });
            if (!resp.ok) throw new Error(`process-receipt returned ${resp.status}`);
          }
        }
        // Mark completed
        await supabaseClient.from("failed_jobs").update({
          status: "completed",
          completed_at: new Date().toISOString(),
        }).eq("id", job.id);
        processed++;
      } catch (retryError) {
        const newAttempts = job.attempts + 1;
        if (newAttempts >= job.max_attempts) {
          await supabaseClient.from("failed_jobs").update({
            status: "failed",
            error_message: retryError?.message || "Unknown error",
          }).eq("id", job.id);

          // Log final failure
          await supabaseClient.from("system_logs").insert({
            level: "error",
            source: "retry-worker",
            message: `Job permanently failed after ${newAttempts} attempts`,
            metadata: { jobId: job.id, jobType: job.job_type, error: retryError?.message },
            organization_id: job.organization_id,
          });
        } else {
          // Schedule next retry with exponential backoff
          const backoffMs = [5000, 30000, 120000];
          const nextRetry = new Date(Date.now() + (backoffMs[newAttempts - 1] || 120000));
          await supabaseClient.from("failed_jobs").update({
            status: "pending",
            next_retry_at: nextRetry.toISOString(),
            error_message: retryError?.message || "Unknown error",
          }).eq("id", job.id);
        }
        failed++;
      }
    }

    return new Response(JSON.stringify({ status: "completed", processed, failed, total: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Retry worker error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
