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

  it("offers retry only for jobs that are not completed", async () => {
    state.jobs = [
      job({ job_type: "done-job", status: "completed" }),
      job({ job_type: "stuck-job", status: "failed" }),
    ];
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /المهام الفاشلة/ }));
    await screen.findByText("done-job");

    const doneRow = screen.getByText("done-job").closest("div.p-3")!;
    const stuckRow = screen.getByText("stuck-job").closest("div.p-3")!;
    expect(doneRow.querySelectorAll("button")).toHaveLength(0);
    expect(stuckRow.querySelectorAll("button")).toHaveLength(1);
  });

  it("includes the scheduled cron jobs report", async () => {
    renderPage();
    expect(await screen.findByText("المهام المجدولة (آخر 24 ساعة)")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Integration: search, sorting, pagination — while keeping organization scope
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

function makeMessages(count: number, over: Record<string, any> = {}) {
  // index 0 is the oldest, index count-1 the newest
  return Array.from({ length: count }, (_, i) =>
    msg({
      from_number: `24990000${String(i).padStart(4, "0")}`,
      message_id: `msg-${String(i).padStart(4, "0")}`,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      ...over,
    })
  );
}

function renderedNumbers() {
  return Array.from(
    document.querySelectorAll('[data-testid="message-sender"]')
  ).map((el) => el.textContent?.trim() ?? "");
}

function typeSearch(value: string) {
  const input = screen.getByLabelText("بحث") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  return input;
}

function orgScopedQueriesOnly() {
  return state.queries
    .filter((q) => q.table !== "cron_job_runs")
    .every((q) =>
      q.filters.some((f: any) => f.column === "organization_id" && f.value === "org-1")
    );
}

describe("ProcessingMonitor — search", () => {
  beforeEach(() => {
    state.messages = [];
    state.jobs = [];
    state.queries = [];
  });

  it("narrows pending messages to the searched sender number", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    typeSearch("249900000001");

    await waitFor(() => {
      expect(screen.getByText("249900000001")).toBeInTheDocument();
      expect(screen.queryByText("249900000000")).not.toBeInTheDocument();
      expect(screen.queryByText("249900000002")).not.toBeInTheDocument();
    });
  });

  it("matches on the message id as well as the sender number", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    typeSearch("msg-0002");

    await waitFor(() => expect(screen.getByText("249900000002")).toBeInTheDocument());
    expect(screen.queryByText("249900000000")).not.toBeInTheDocument();
  });

  it("shows a no-results message instead of the empty state when search matches nothing", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    typeSearch("zzz-no-match");

    expect(await screen.findByText("لا توجد نتائج مطابقة للبحث")).toBeInTheDocument();
    expect(
      screen.queryByText("لا توجد رسائل معلقة — كل شيء تمت معالجته ✓")
    ).not.toBeInTheDocument();
  });

  it("searches failed jobs by job type and error text", async () => {
    state.jobs = [
      job({ job_type: "process-receipt", error_message: "timeout" }),
      job({ job_type: "send-notification", error_message: "quota exceeded" }),
    ];
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /المهام الفاشلة/ }));
    await screen.findByText("process-receipt");

    typeSearch("quota");

    await waitFor(() => {
      expect(screen.getByText("send-notification")).toBeInTheDocument();
      expect(screen.queryByText("process-receipt")).not.toBeInTheDocument();
    });
  });

  it("keeps the organization filter on every query while searching", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    typeSearch("249900000001");
    await waitFor(() => expect(screen.queryByText("249900000000")).not.toBeInTheDocument());

    expect(state.queries.length).toBeGreaterThan(4);
    expect(orgScopedQueriesOnly()).toBe(true);
  });
});

describe("ProcessingMonitor — sorting", () => {
  beforeEach(() => {
    state.messages = [];
    state.jobs = [];
    state.queries = [];
  });

  it("lists the newest message first by default", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    expect(renderedNumbers()).toEqual([
      "249900000002",
      "249900000001",
      "249900000000",
    ]);
  });

  it("reverses the order when switching to oldest first", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    fireEvent.click(screen.getByLabelText("ترتيب"));

    await waitFor(() =>
      expect(renderedNumbers()).toEqual([
        "249900000000",
        "249900000001",
        "249900000002",
      ])
    );
    expect(screen.getByLabelText("ترتيب").textContent).toContain("الأقدم أولاً");
  });

  it("applies sorting on top of the active search", async () => {
    state.messages = makeMessages(12);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000011");

    typeSearch("2499000000"); // matches 0000..0009
    await waitFor(() => expect(renderedNumbers()).toHaveLength(PAGE_SIZE));
    expect(renderedNumbers()[0]).toBe("249900000009");

    fireEvent.click(screen.getByLabelText("ترتيب"));
    await waitFor(() => expect(renderedNumbers()[0]).toBe("249900000000"));
  });

  it("keeps the organization filter after re-sorting", async () => {
    state.messages = makeMessages(3);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000000");

    fireEvent.click(screen.getByLabelText("ترتيب"));
    await waitFor(() => expect(renderedNumbers()[0]).toBe("249900000000"));

    expect(orgScopedQueriesOnly()).toBe(true);
  });
});

describe("ProcessingMonitor — pagination", () => {
  beforeEach(() => {
    state.messages = [];
    state.jobs = [];
    state.queries = [];
  });

  it("shows only one page of messages at a time", async () => {
    state.messages = makeMessages(25);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000024");

    expect(renderedNumbers()).toHaveLength(PAGE_SIZE);
    expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 1 من 3");
    expect(screen.getByTestId("pagination-info").textContent).toContain("25 عنصر");
  });

  it("moves to the next page and back again", async () => {
    state.messages = makeMessages(25);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000024");

    fireEvent.click(screen.getByLabelText("الصفحة التالية"));
    await waitFor(() => expect(renderedNumbers()[0]).toBe("249900000014"));
    expect(screen.queryByText("249900000024")).not.toBeInTheDocument();
    expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 2 من 3");

    fireEvent.click(screen.getByLabelText("الصفحة السابقة"));
    await waitFor(() => expect(renderedNumbers()[0]).toBe("249900000024"));
  });

  it("disables previous on the first page and next on the last page", async () => {
    state.messages = makeMessages(15);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000014");

    expect(screen.getByLabelText("الصفحة السابقة")).toBeDisabled();
    expect(screen.getByLabelText("الصفحة التالية")).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText("الصفحة التالية"));
    await waitFor(() => expect(screen.getByLabelText("الصفحة التالية")).toBeDisabled());
    expect(screen.getByLabelText("الصفحة السابقة")).not.toBeDisabled();
    expect(renderedNumbers()).toHaveLength(5);
  });

  it("returns to the first page when a search is typed", async () => {
    state.messages = makeMessages(25);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000024");

    fireEvent.click(screen.getByLabelText("الصفحة التالية"));
    await waitFor(() =>
      expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 2")
    );

    typeSearch("24990000001"); // matches 0010..0019
    await waitFor(() =>
      expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 1 من 1")
    );
    expect(renderedNumbers()[0]).toBe("249900000019");
  });

  it("returns to the first page when the tab changes", async () => {
    state.messages = [
      ...makeMessages(25),
      ...makeMessages(3, { processed: true, processed_at: new Date().toISOString() }),
    ];
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000024");

    fireEvent.click(screen.getByLabelText("الصفحة التالية"));
    await waitFor(() =>
      expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 2")
    );

    selectTab(screen.getByRole("tab", { name: /تمت المعالجة/ }));
    await waitFor(() =>
      expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 1 من 1")
    );
  });

  it("paginates failed jobs independently of messages", async () => {
    state.jobs = Array.from({ length: 12 }, (_, i) =>
      job({
        job_type: `job-${String(i).padStart(2, "0")}`,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      })
    );
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /المهام الفاشلة/ }));
    await screen.findByText("job-11");

    expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 1 من 2");
    fireEvent.click(screen.getByLabelText("الصفحة التالية"));
    await waitFor(() => expect(screen.getByText("job-01")).toBeInTheDocument());
    expect(screen.getByText("job-00")).toBeInTheDocument();
    expect(screen.queryByText("job-11")).not.toBeInTheDocument();
  });

  it("never drops the organization filter while paging", async () => {
    state.messages = makeMessages(25);
    renderPage();
    selectTab(await screen.findByRole("tab", { name: /في الانتظار/ }));
    await screen.findByText("249900000024");

    fireEvent.click(screen.getByLabelText("الصفحة التالية"));
    await waitFor(() =>
      expect(screen.getByTestId("pagination-info").textContent).toContain("صفحة 2")
    );

    expect(state.queries.length).toBeGreaterThan(4);
    expect(orgScopedQueriesOnly()).toBe(true);
    expect(
      state.queries.filter((q) => q.table === "whatsapp_messages").length
    ).toBeGreaterThan(0);
  });
});
