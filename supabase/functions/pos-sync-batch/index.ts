import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QueuedInvoice {
  client_local_id: string;
  branch_id: string;
  organization_id: string;
  total_amount: number;
  payment_method: "cash" | "bank_transfer" | "card";
  invoice_number: string;
  created_at_local: string;
  notes?: string;
  items: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const { invoices } = (await req.json()) as { invoices: QueuedInvoice[] };
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return json({ synced: [], failed: [] });
    }

    const synced: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const q of invoices) {
      try {
        // Check membership
        const { data: role } = await sb
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("organization_id", q.organization_id)
          .maybeSingle();
        if (!role) {
          failed.push({ id: q.client_local_id, error: "not_org_member" });
          continue;
        }

        // Idempotency: has this client_local_id already been synced?
        const { data: existing } = await sb
          .from("pos_invoices")
          .select("id")
          .eq("client_local_id", q.client_local_id)
          .eq("organization_id", q.organization_id)
          .maybeSingle();
        if (existing) {
          synced.push(q.client_local_id);
          continue;
        }

        const status = q.payment_method === "bank_transfer" ? "pending_image" : "confirmed";
        const { data: inv, error: invErr } = await sb
          .from("pos_invoices")
          .insert({
            organization_id: q.organization_id,
            branch_id: q.branch_id,
            cashier_id: userId,
            invoice_number: q.invoice_number,
            total_amount: q.total_amount,
            payment_method: q.payment_method,
            status,
            client_local_id: q.client_local_id,
            notes: q.notes,
            created_at_local: q.created_at_local,
          })
          .select("id")
          .single();
        if (invErr) throw invErr;

        const items = q.items.map((it) => ({ ...it, invoice_id: (inv as any).id }));
        const { error: itemsErr } = await sb.from("pos_invoice_items").insert(items);
        if (itemsErr) throw itemsErr;

        // If it's a bank transfer, try to auto-match against existing confirmed transfers
        if (status === "pending_image") {
          const ts = new Date(q.created_at_local).toISOString();
          await sb.rpc("match_pending_pos_invoice", {
            _org: q.organization_id,
            _amount: q.total_amount,
            _timestamp: ts,
          });
        }

        synced.push(q.client_local_id);
      } catch (e: any) {
        failed.push({ id: q.client_local_id, error: e.message || String(e) });
      }
    }

    return json({ synced, failed });
  } catch (e: any) {
    return json({ error: e.message || "internal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
