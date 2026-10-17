/** Pure retry / background-job policy shared by retry-failed-jobs (and tests). */

export interface FailedJobLike {
  id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
}

/** Exponential backoff schedule, in milliseconds, per completed attempt. */
export const BACKOFF_MS = [5000, 30000, 120000];

export function nextRetryDelayMs(attempts: number): number {
  if (attempts < 1) return BACKOFF_MS[0];
  return BACKOFF_MS[attempts - 1] ?? 120000;
}

export function nextRetryAt(attempts: number, nowMs: number = Date.now()): Date {
  return new Date(nowMs + nextRetryDelayMs(attempts));
}

/** A job is picked up when it is pending, due, and under the attempt ceiling. */
export function isJobDue(job: FailedJobLike, nowMs: number = Date.now()): boolean {
  if (job.status !== "pending") return false;
  if (job.attempts >= 3) return false;
  if (!job.next_retry_at) return true;
  return new Date(job.next_retry_at).getTime() <= nowMs;
}

/** After a failed attempt, should the job be parked as permanently failed? */
export function isPermanentFailure(job: FailedJobLike): boolean {
  return job.attempts + 1 >= job.max_attempts;
}

/** Aggregate run status reported to cron_job_runs. */
export function runStatus(processed: number, failed: number): "success" | "partial" | "failed" {
  if (failed === 0) return "success";
  if (processed === 0) return "failed";
  return "partial";
}

/** Constant-time-ish string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Authorization gate used by the cron-only edge functions. */
export function isCronAuthorized(opts: {
  authHeader?: string | null;
  cronHeader?: string | null;
  serviceKey?: string;
  cronSecret?: string;
}): boolean {
  const auth = opts.authHeader ?? "";
  const presented = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const serviceKey = opts.serviceKey ?? "";
  const cronSecret = opts.cronSecret ?? "";
  return (
    (!!serviceKey && safeEqual(presented, serviceKey)) ||
    (!!cronSecret && safeEqual(opts.cronHeader ?? "", cronSecret))
  );
}
