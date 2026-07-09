import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "revenue_summary",
  title: "Revenue summary",
  description:
    "Summarize confirmed revenue between two dates (inclusive, YYYY-MM-DD) for the signed-in user's organization. Optionally filter by branch_id. Returns total_amount (SDG), confirmed_count, rejected_count.",
  inputSchema: {
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date, YYYY-MM-DD"),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("End date, YYYY-MM-DD"),
    branch_id: z.string().uuid().optional().describe("Optional branch UUID"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, to_date, branch_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("transfers")
      .select("amount,is_confirmed,needs_review,fraud_score", { count: "exact" })
      .eq("is_deleted", false)
      .gte("transfer_date", from_date)
      .lte("transfer_date", to_date);
    if (branch_id) q = q.eq("branch_id", branch_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const total_amount = rows
      .filter((r: any) => r.is_confirmed)
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const confirmed_count = rows.filter((r: any) => r.is_confirmed).length;
    const rejected_count = rows.filter(
      (r: any) => (r.fraud_score ?? 0) > 0 || r.needs_review,
    ).length;

    const summary = {
      from_date,
      to_date,
      branch_id: branch_id ?? null,
      total_amount,
      currency: "SDG",
      confirmed_count,
      rejected_count,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
