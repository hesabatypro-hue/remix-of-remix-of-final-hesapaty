import { useEffect, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface POSInvoice {
  id: string;
  invoice_number: string;
  organization_id: string;
  branch_id: string;
  cashier_id: string | null;
  total_amount: number;
  payment_method: "cash" | "bank_transfer" | "card";
  status: "pending_image" | "confirmed" | "cancelled" | "ghost";
  transfer_id: string | null;
  bank_reference: string | null;
  created_at: string;
}

export interface POSInvoiceItemInput {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface QueuedInvoice {
  client_local_id: string;
  branch_id: string;
  organization_id: string;
  total_amount: number;
  payment_method: POSInvoice["payment_method"];
  items: POSInvoiceItemInput[];
  invoice_number: string;
  created_at_local: string;
  notes?: string;
}

const QUEUE_KEY = "pos_offline_queue_v1";

function readQueue(): QueuedInvoice[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: QueuedInvoice[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function usePOSInvoices(branchId?: string) {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [queueSize, setQueueSize] = useState<number>(() => readQueue().length);

  const invoices = useQuery({
    queryKey: ["pos-invoices", currentOrganization?.id, branchId],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      let q = supabase
        .from("pos_invoices" as any)
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as POSInvoice[]) ?? [];
    },
  });

  const flushQueue = useCallback(async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine) return;
    try {
      const { data, error } = await supabase.functions.invoke("pos-sync-batch", {
        body: { invoices: q },
      });
      if (error) throw error;
      const synced: string[] = (data as any)?.synced ?? [];
      const remaining = q.filter((x) => !synced.includes(x.client_local_id));
      writeQueue(remaining);
      setQueueSize(remaining.length);
      if (synced.length) {
        toast({ title: "تمت مزامنة الفواتير غير المتصلة", description: `${synced.length} فاتورة` });
        qc.invalidateQueries({ queryKey: ["pos-invoices"] });
      }
    } catch (e) {
      console.warn("pos-sync-batch failed", e);
    }
  }, [qc, toast]);

  // Flush when we come back online
  useEffect(() => {
    const onOnline = () => flushQueue();
    window.addEventListener("online", onOnline);
    // Try once at mount
    flushQueue();
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueue]);

  const createInvoice = useMutation({
    mutationFn: async (input: {
      branch_id: string;
      total_amount: number;
      payment_method: POSInvoice["payment_method"];
      items: POSInvoiceItemInput[];
      client_local_id?: string;
      notes?: string;
    }) => {
      if (!currentOrganization?.id) throw new Error("no org");
      const invoice_number = `POS-${Date.now()}`;
      const client_local_id =
        input.client_local_id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Offline path → enqueue locally
      if (!navigator.onLine) {
        const q = readQueue();
        q.push({
          client_local_id,
          branch_id: input.branch_id,
          organization_id: currentOrganization.id,
          total_amount: input.total_amount,
          payment_method: input.payment_method,
          items: input.items,
          invoice_number,
          created_at_local: new Date().toISOString(),
          notes: input.notes,
        });
        writeQueue(q);
        setQueueSize(q.length);
        return {
          id: client_local_id,
          invoice_number,
          organization_id: currentOrganization.id,
          branch_id: input.branch_id,
          cashier_id: null,
          total_amount: input.total_amount,
          payment_method: input.payment_method,
          status: input.payment_method === "bank_transfer" ? "pending_image" : "confirmed",
          transfer_id: null,
          bank_reference: null,
          created_at: new Date().toISOString(),
        } as POSInvoice;
      }

      const { data: userData } = await supabase.auth.getUser();
      const status = input.payment_method === "bank_transfer" ? "pending_image" : "confirmed";

      const { data: inv, error: invErr } = await supabase
        .from("pos_invoices" as any)
        .insert({
          organization_id: currentOrganization.id,
          branch_id: input.branch_id,
          cashier_id: userData.user?.id,
          invoice_number,
          total_amount: input.total_amount,
          payment_method: input.payment_method,
          status,
          client_local_id,
          notes: input.notes,
          created_at_local: new Date().toISOString(),
        })
        .select()
        .single();
      if (invErr) throw invErr;

      const items = input.items.map((it) => ({ ...it, invoice_id: (inv as any).id }));
      const { error: itemsErr } = await supabase.from("pos_invoice_items" as any).insert(items);
      if (itemsErr) throw itemsErr;

      return inv as unknown as POSInvoice;
    },
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["pos-invoices"] });
      qc.invalidateQueries({ queryKey: ["branch-inventory"] });
      const offline = !navigator.onLine;
      toast({
        title: offline
          ? "⏳ محفوظة محلياً — ستُزامن تلقائياً"
          : inv.status === "pending_image"
            ? "فاتورة بانتظار التحويل"
            : "تم إتمام البيع",
        description: `#${inv.invoice_number} — ${inv.total_amount} ج.س`,
      });
    },
    onError: (e: any) =>
      toast({ title: "خطأ في إنشاء الفاتورة", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!currentOrganization?.id) return;
    const channel = supabase
      .channel(`pos_invoices_${currentOrganization.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pos_invoices",
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        (payload: any) => {
          const n = payload.new;
          const o = payload.old;
          if (o?.status === "pending_image" && n?.status === "confirmed") {
            try {
              new Audio("/pos-chime.mp3").play().catch(() => {});
            } catch {}
            toast({
              title: "✅ تم تأكيد فاتورة عبر WhatsApp",
              description: `#${n.invoice_number} — ${n.total_amount} ج.س`,
            });
            qc.invalidateQueries({ queryKey: ["pos-invoices"] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, qc, toast]);

  return { invoices, createInvoice, queueSize, flushQueue };
}
