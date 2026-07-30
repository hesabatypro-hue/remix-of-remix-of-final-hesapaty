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
  name: "list_recent_transfers",
  title: "List recent transfers",
  description:
    "List the most recent bank transfers for the signed-in user's organization. Optional branch_id filter and limit (1-50, default 10).",
  inputSchema: {
    branch_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ branch_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("transfers")
      .select(
        "id,branch_id,amount,transfer_date,sender_name,is_confirmed,needs_review,client_memo,created_at",
      )
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (branch_id) q = q.eq("branch_id", branch_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { transfers: data ?? [] },
    };
  },
});
