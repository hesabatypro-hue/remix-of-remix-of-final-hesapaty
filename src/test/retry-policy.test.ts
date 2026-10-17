import { describe, it, expect } from "vitest";
import {
  BACKOFF_MS,
  nextRetryDelayMs,
  nextRetryAt,
  isJobDue,
  isPermanentFailure,
  runStatus,
  safeEqual,
  isCronAuthorized,
  type FailedJobLike,
} from "../../supabase/functions/_shared/retry-policy";

function job(overrides: Partial<FailedJobLike> = {}): FailedJobLike {
  return {
    id: "job-1",
    status: "pending",
    attempts: 0,
    max_attempts: 3,
    next_retry_at: null,
    ...overrides,
  };
}

describe("retry backoff", () => {
  it("follows the 5s / 30s / 2m schedule", () => {
    expect(BACKOFF_MS).toEqual([5000, 30000, 120000]);
    expect(nextRetryDelayMs(1)).toBe(5000);
    expect(nextRetryDelayMs(2)).toBe(30000);
    expect(nextRetryDelayMs(3)).toBe(120000);
  });

  it("clamps out-of-range attempt counters", () => {
    expect(nextRetryDelayMs(0)).toBe(5000);
    expect(nextRetryDelayMs(-3)).toBe(5000);
    expect(nextRetryDelayMs(99)).toBe(120000);
  });

  it("computes the next retry timestamp from a fixed clock", () => {
    const now = Date.UTC(2026, 7, 6, 4, 0, 0);
    expect(nextRetryAt(2, now).toISOString()).toBe("2026-08-06T04:00:30.000Z");
  });
});

describe("job eligibility", () => {
  it("picks up pending jobs that are due", () => {
    const now = Date.now();
    expect(isJobDue(job(), now)).toBe(true);
    expect(isJobDue(job({ next_retry_at: new Date(now - 1000).toISOString() }), now)).toBe(true);
  });

  it("skips jobs scheduled for the future", () => {
    const now = Date.now();
    expect(isJobDue(job({ next_retry_at: new Date(now + 60000).toISOString() }), now)).toBe(false);
  });

  it("skips non-pending jobs and exhausted attempts", () => {
    expect(isJobDue(job({ status: "processing" }))).toBe(false);
    expect(isJobDue(job({ status: "completed" }))).toBe(false);
    expect(isJobDue(job({ attempts: 3 }))).toBe(false);
  });

  it("parks a job permanently once max_attempts is reached", () => {
    expect(isPermanentFailure(job({ attempts: 2, max_attempts: 3 }))).toBe(true);
    expect(isPermanentFailure(job({ attempts: 1, max_attempts: 3 }))).toBe(false);
  });
});

describe("cron run reporting", () => {
  it("classifies runs for cron_job_runs", () => {
    expect(runStatus(5, 0)).toBe("success");
    expect(runStatus(0, 0)).toBe("success");
    expect(runStatus(3, 2)).toBe("partial");
    expect(runStatus(0, 4)).toBe("failed");
  });
});

describe("cron authorization", () => {
  it("compares secrets without early exit on content", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });

  it("accepts a service-role bearer token", () => {
    expect(
      isCronAuthorized({ authHeader: "Bearer svc-key", serviceKey: "svc-key", cronSecret: "cron" }),
    ).toBe(true);
    expect(
      isCronAuthorized({ authHeader: "bearer svc-key", serviceKey: "svc-key" }),
    ).toBe(true);
  });

  it("accepts the pg_cron shared secret header", () => {
    expect(isCronAuthorized({ cronHeader: "cron-secret", cronSecret: "cron-secret" })).toBe(true);
  });

  it("fails closed on wrong, missing or unconfigured secrets", () => {
    expect(isCronAuthorized({ authHeader: "Bearer nope", serviceKey: "svc-key" })).toBe(false);
    expect(isCronAuthorized({ cronHeader: "nope", cronSecret: "cron-secret" })).toBe(false);
    expect(isCronAuthorized({})).toBe(false);
    expect(isCronAuthorized({ authHeader: "Bearer x", serviceKey: "", cronSecret: "" })).toBe(false);
    expect(isCronAuthorized({ authHeader: "svc-key", serviceKey: "svc-key" })).toBe(false);
  });
});
