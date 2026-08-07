import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { QueryState } from "./supabase-mock";

const h = vi.hoisted(() => ({
  state: { rows: [] as any[], lastQuery: null as any, error: null as any },
}));
const state = h.state as { rows: any[]; lastQuery: QueryState | null; error: any };

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("./supabase-mock");
  return {
    supabase: createSupabaseMock((q) => {
      h.state.lastQuery = q;
      if (h.state.error) return { error: h.state.error };
      return { data: h.state.rows };
    }),
  };
});

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

function badgeTexts() {
  return Array.from(document.querySelectorAll("div.rounded-full")).map((el) =>
    (el.textContent || "").replace(/\s+/g, " ").trim()
  );
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

    await screen.findByText("إعادة محاولة المهام الفاشلة");
    await waitFor(() => expect(badgeTexts()).toContain("نجاح 2"));
    // retry-failed-jobs: 2 success, 1 partial, 1 failed
    expect(badgeTexts()).toEqual(["نجاح 2", "جزئي 1", "فشل 1", "نجاح 1", "فشل 0"]);
  });

  it("does not leak one job's runs into the other job's card", async () => {
    state.rows = [run({ job_name: "cleanup-receipts", status: "failed", error_message: "storage down" })];
    renderCard();
    await waitFor(() => expect(badgeTexts()).toContain("فشل 1"));
    // retry-failed-jobs stays empty, cleanup-receipts owns the failure
    expect(badgeTexts()).toEqual(["نجاح 0", "فشل 0", "نجاح 0", "فشل 1"]);
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
    await waitFor(() => expect(badgeTexts()).toEqual(["نجاح 0", "فشل 0", "نجاح 0", "فشل 0"]));
    expect(screen.getAllByText(/لم يُشغّل بعد/)).toHaveLength(1);
  });

  it("keeps rendering the card shell when the query fails", async () => {
    state.error = { message: "permission denied" };
    renderCard();
    expect(
      await screen.findByText("المهام المجدولة (آخر 24 ساعة)")
    ).toBeInTheDocument();
  });
});
