import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { QueryState } from "./supabase-mock";

const h = vi.hoisted(() => ({
  state: {
    messages: [] as any[],
    jobs: [] as any[],
    queries: [] as any[],
  },
}));
const state = h.state as { messages: any[]; jobs: any[]; queries: QueryState[] };

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("./supabase-mock");
  return {
    supabase: createSupabaseMock((q) => {
      h.state.queries.push(q);
      const has = (col: string, val: unknown) =>
        q.filters.some((f: any) => f.column === col && f.value === val);

      if (q.table === "whatsapp_messages") {
        let rows = h.state.messages;
        if (has("processed", false)) rows = rows.filter((m) => !m.processed);
        if (has("processed", true)) rows = rows.filter((m) => m.processed);
        return q.head ? { count: rows.length } : { data: rows };
      }
      if (q.table === "failed_jobs") {
        let rows = h.state.jobs;
        const statusFilter = q.filters.find((f: any) => f.column === "status");
        if (q.head && statusFilter) rows = rows.filter((j) => j.status === statusFilter.value);
        return q.head ? { count: rows.length } : { data: rows };
      }
      return { data: [] };
    }),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentOrganization: { id: "org-1", name: "متجر" } }),
}));

vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ProcessingMonitor from "@/pages/ProcessingMonitor";

const msg = (over: Record<string, any> = {}) => ({
  id: crypto.randomUUID(),
  message_id: "msg-abcdef123456",
  from_number: "249900000001",
  message_type: "image",
  processed: false,
  processed_at: null,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  ...over,
});

const job = (over: Record<string, any> = {}) => ({
  id: crypto.randomUUID(),
  job_type: "process-receipt",
  status: "pending",
  attempts: 1,
  max_attempts: 5,
  error_message: "timeout",
  created_at: new Date(Date.now() - 120_000).toISOString(),
  ...over,
});

function selectTab(tab: HTMLElement) {
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProcessingMonitor />
    </QueryClientProvider>
  );
}

describe("ProcessingMonitor page", () => {
  beforeEach(() => {
    state.messages = [];
    state.jobs = [];
    state.queries = [];
  });

  it("renders the page header", async () => {
    renderPage();
    expect(await screen.findByText("مراقبة المعالجة")).toBeInTheDocument();
  });

  it("shows aggregate counters for images and jobs", async () => {
    state.messages = [msg(), msg({ processed: true }), msg({ processed: true })];
    state.jobs = [job(), job({ status: "completed" }), job({ status: "completed" })];
    renderPage();

    await waitFor(() => {
      const total = screen.getByText("إجمالي الصور").previousSibling as HTMLElement;
      expect(total.textContent).toBe("3");
    });
    expect((screen.getByText("في الانتظار", { selector: "p" }).previousSibling as HTMLElement).textContent).toBe("1");
    expect((screen.getByText("تمت المعالجة", { selector: "p" }).previousSibling as HTMLElement).textContent).toBe("2");
    expect((screen.getByText("مهام فاشلة").previousSibling as HTMLElement).textContent).toBe("1");
    expect((screen.getByText("مهام مكتملة").previousSibling as HTMLElement).textContent).toBe("2");
  });

  it("scopes every query to the current organization", async () => {
    renderPage();
    await waitFor(() => expect(state.queries.length).toBeGreaterThan(4));
    expect(
      state.queries
        .filter((q) => q.table !== "cron_job_runs")
        .every((q) =>
          q.filters.some((f: any) => f.column === "organization_id" && f.value === "org-1")
        )
    ).toBe(true);
  });

  it("filters to unprocessed images on the pending tab", async () => {
    state.messages = [
      msg({ from_number: "249900000001" }),
      msg({ from_number: "249900000002", processed: true, processed_at: new Date().toISOString() }),
    ];
    renderPage();

    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    expect(await screen.findByText("249900000001")).toBeInTheDocument();
    expect(screen.queryByText("249900000002")).not.toBeInTheDocument();
  });

  it("filters to processed images on the processed tab", async () => {
    state.messages = [
      msg({ from_number: "249900000001" }),
      msg({ from_number: "249900000002", processed: true, processed_at: new Date().toISOString() }),
    ];
    renderPage();

    selectTab(await screen.findByRole("tab", { name: /تمت المعالجة/ }));
    expect(await screen.findByText("249900000002")).toBeInTheDocument();
    expect(screen.queryByText("249900000001")).not.toBeInTheDocument();
  });

  it("lists failed jobs with attempt counters on the failed tab", async () => {
    state.jobs = [job({ job_type: "process-receipt", attempts: 2, max_attempts: 5 })];
    renderPage();

    selectTab(await screen.findByRole("tab", { name: /المهام الفاشلة/ }));
    expect(await screen.findByText("process-receipt")).toBeInTheDocument();
    expect(screen.getByText("محاولة 2/5")).toBeInTheDocument();
    expect(screen.getByText(/timeout/)).toBeInTheDocument();
  });

  it("shows the healthy empty state when no jobs failed", async () => {
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /المهام الفاشلة/ }));
    expect(
      await screen.findByText("لا توجد مهام فاشلة — النظام يعمل بكفاءة ✓")
    ).toBeInTheDocument();
  });

  it("hides the retry button for completed jobs only", async () => {
    state.jobs = [
      job({ job_type: "done-job", status: "completed" }),
      job({ job_type: "stuck-job", status: "failed" }),
    ];
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /المهام الفاشلة/ }));
    await screen.findByText("done-job");
    expect(screen.getByText("مكتمل")).toBeInTheDocument();
    expect(screen.getByText("فشل نهائي")).toBeInTheDocument();
    // one retry button for the failed job, none for the completed one
    const rows = screen.getByText("stuck-job").closest("div.flex")!.parentElement!.parentElement!;
    expect(rows.querySelectorAll("button")).toHaveLength(1);
  });

  it("includes the scheduled cron jobs report", async () => {
    renderPage();
    expect(await screen.findByText("المهام المجدولة (آخر 24 ساعة)")).toBeInTheDocument();
  });
});
