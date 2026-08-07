import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createSupabaseMock, type QueryState } from "./supabase-mock";

const state = { rows: [] as any[], lastQuery: null as QueryState | null, error: null as any };

const supabaseMock = createSupabaseMock((q) => {
  state.lastQuery = q;
  if (state.error) return { error: state.error };
  return { data: state.rows };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { CronJobsCard } from "@/components/monitoring/CronJobsCard";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function run(over: Partial<Record<string, any>> = {}) {
  return {
    id: crypto.randomUUID(),
    job_name: "retry-failed-jobs",
    status: "success",
    started_at: minutesAgo(5),
    duration_ms: 120,
    details: {},
    error_message: null,
    ...over,
  };
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CronJobsCard />
    </QueryClientProvider>
  );
}

describe("CronJobsCard", () => {
  beforeEach(() => {
    state.rows = [];
    state.error = null;
    state.lastQuery = null;
  });

  it("queries cron_job_runs limited to the last 24 hours", async () => {
    renderCard();
    await waitFor(() => expect(state.lastQuery?.table).toBe("cron_job_runs"));
    const gte = state.lastQuery!.filters.find((f) => f.op === "gte" && f.column === "started_at");
    expect(gte).toBeTruthy();
    const since = new Date(gte!.value as string).getTime();
    expect(Date.now() - since).toBeGreaterThan(23 * 3600_000);
    expect(Date.now() - since).toBeLessThanOrEqual(24 * 3600_000 + 5000);
  });

  it("shows both scheduled jobs as never run when there are no records", async () => {
    renderCard();
    expect(
      await screen.findByText("إعادة محاولة المهام الفاشلة")
    ).toBeInTheDocument();
    expect(screen.getByText("تنظيف الإيصالات والملفات القديمة")).toBeInTheDocument();
    expect(screen.getAllByText(/لم يُشغّل بعد/)).toHaveLength(2);
  });

  it("counts success / partial / failed runs per job independently", async () => {
    state.rows = [
      run({ job_name: "retry-failed-jobs", status: "failed", started_at: minutesAgo(1), error_message: "boom" }),
      run({ job_name: "retry-failed-jobs", status: "success" }),
      run({ job_name: "retry-failed-jobs", status: "success" }),
      run({ job_name: "retry-failed-jobs", status: "partial" }),
      run({ job_name: "cleanup-receipts", status: "success" }),
    ];
    renderCard();

    // retry-failed-jobs: 2 success, 1 partial, 1 failed
    expect(await screen.findByText("نجاح 2")).toBeInTheDocument();
    expect(screen.getByText("جزئي 1")).toBeInTheDocument();
    expect(screen.getByText("فشل 1")).toBeInTheDocument();
    // cleanup-receipts: 1 success, 0 failures, no partial badge
    expect(screen.getByText("نجاح 1")).toBeInTheDocument();
    expect(screen.getByText("فشل 0")).toBeInTheDocument();
  });

  it("does not leak one job's runs into the other job's card", async () => {
    state.rows = [run({ job_name: "cleanup-receipts", status: "failed", error_message: "storage down" })];
    renderCard();
    expect(await screen.findByText("فشل 1")).toBeInTheDocument();
    expect(screen.getByText("نجاح 0")).toBeInTheDocument();
    // the untouched job still reads as never executed
    expect(screen.getAllByText(/لم يُشغّل بعد/)).toHaveLength(1);
  });

  it("surfaces the latest error message", async () => {
    state.rows = [
      run({ status: "failed", started_at: minutesAgo(1), error_message: "cron secret rejected" }),
      run({ status: "success", started_at: minutesAgo(30) }),
    ];
    renderCard();
    expect(await screen.findByText("cron secret rejected")).toBeInTheDocument();
  });

  it("renders run details with the duration", async () => {
    state.rows = [run({ details: { retried: 3 }, duration_ms: 412 })];
    renderCard();
    expect(await screen.findByText(/{"retried":3} • 412ms/)).toBeInTheDocument();
  });

  it("treats an unknown status as partial styling without crashing", async () => {
    state.rows = [run({ status: "weird" })];
    renderCard();
    expect(await screen.findByText("نجاح 0")).toBeInTheDocument();
  });

  it("keeps rendering the card shell when the query fails", async () => {
    state.error = { message: "permission denied" };
    renderCard();
    expect(
      await screen.findByText("المهام المجدولة (آخر 24 ساعة)")
    ).toBeInTheDocument();
  });
});
