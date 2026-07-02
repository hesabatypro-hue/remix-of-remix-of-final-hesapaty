import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { newIdempotencyKey, isIdempotencyReplay } from "@/lib/idempotency";

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order?: number;
}

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  from_company: string;
  from_address: string | null;
  from_email: string | null;
  to_client: string;
  to_address: string | null;
  to_email: string | null;
  project_name: string | null;
  status: "draft" | "sent" | "paid" | "overdue";
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export interface InvoiceInput {
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  from_company: string;
  from_address?: string;
  from_email?: string;
  to_client: string;
  to_address?: string;
  to_email?: string;
  project_name?: string;
  status: Invoice["status"];
  currency: string;
  tax_rate: number;
  notes?: string;
  items: InvoiceItem[];
}

export const useInvoices = () => {
  const { currentOrganization, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const orgId = currentOrganization?.id;

  const list = useQuery({
    queryKey: ["invoices", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("is_deleted", false)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });

  const getInvoice = async (id: string): Promise<InvoiceWithItems> => {
    const { data: inv, error: e1 } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();
    if (e1) throw e1;
    const { data: items, error: e2 } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true });
    if (e2) throw e2;
    return { ...(inv as Invoice), items: (items || []) as InvoiceItem[] };
  };

  const computeTotals = (input: InvoiceInput) => {
    const subtotal = input.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
    const tax_amount = subtotal * ((Number(input.tax_rate) || 0) / 100);
    const total_amount = subtotal + tax_amount;
    return { subtotal, tax_amount, total_amount };
  };

  const create = useMutation({
    mutationFn: async (input: InvoiceInput) => {
      if (!orgId) throw new Error("لا توجد مؤسسة محددة");
      const totals = computeTotals(input);
      const idempotencyKey = newIdempotencyKey();
      const { data: inv, error } = await (supabase
        .from("invoices") as any)
        .insert({
          organization_id: orgId,
          invoice_number: input.invoice_number,
          invoice_date: input.invoice_date,
          due_date: input.due_date || null,
          from_company: input.from_company,
          from_address: input.from_address || null,
          from_email: input.from_email || null,
          to_client: input.to_client,
          to_address: input.to_address || null,
          to_email: input.to_email || null,
          project_name: input.project_name || null,
          status: input.status,
          currency: input.currency,
          tax_rate: input.tax_rate,
          subtotal: totals.subtotal,
          tax_amount: totals.tax_amount,
          total_amount: totals.total_amount,
          notes: input.notes || null,
          created_by: user?.id,
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();
      if (error) {
        if (isIdempotencyReplay(error)) {
          // Retry of the same submit — fetch the existing row and return it.
          const { data: existing } = await (supabase
            .from("invoices") as any)
            .select()
            .eq("organization_id", orgId)
            .eq("idempotency_key", idempotencyKey)
            .single();
          if (existing) return existing;
        }
        throw error;
      }

      if (input.items.length > 0) {
        const { error: itemsError } = await supabase.from("invoice_items").insert(
          input.items.map((it, idx) => ({
            invoice_id: inv.id,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
            sort_order: idx,
          }))
        );
        if (itemsError) throw itemsError;
      }
      return inv;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      toast({ title: "تم بنجاح", description: "تم إنشاء الفاتورة" });
    },
    onError: (e: Error) => {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: InvoiceInput }) => {
      const totals = computeTotals(input);
      const { error } = await supabase
        .from("invoices")
        .update({
          invoice_number: input.invoice_number,
          invoice_date: input.invoice_date,
          due_date: input.due_date || null,
          from_company: input.from_company,
          from_address: input.from_address || null,
          from_email: input.from_email || null,
          to_client: input.to_client,
          to_address: input.to_address || null,
          to_email: input.to_email || null,
          project_name: input.project_name || null,
          status: input.status,
          currency: input.currency,
          tax_rate: input.tax_rate,
          subtotal: totals.subtotal,
          tax_amount: totals.tax_amount,
          total_amount: totals.total_amount,
          notes: input.notes || null,
        })
        .eq("id", id);
      if (error) throw error;

      // replace items
      await supabase.from("invoice_items").delete().eq("invoice_id", id);
      if (input.items.length > 0) {
        const { error: e2 } = await supabase.from("invoice_items").insert(
          input.items.map((it, idx) => ({
            invoice_id: id,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
            sort_order: idx,
          }))
        );
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      toast({ title: "تم بنجاح", description: "تم تحديث الفاتورة" });
    },
    onError: (e: Error) => {
      const msg = e.message || "";
      const friendly = msg.includes("PAID_INVOICE_LOCKED")
        ? "لا يمكن تعديل فاتورة مدفوعة"
        : msg;
      toast({ title: "خطأ", description: friendly, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('soft_delete_invoice', { _invoice_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", orgId] });
      toast({ title: "تم الحذف", description: "تم حذف الفاتورة" });
    },
    onError: (e: Error) => {
      const msg = e.message || "";
      const friendly = msg.includes("NOT_AUTHORIZED")
        ? "ليس لديك صلاحية حذف هذه الفاتورة"
        : msg.includes("INVOICE_NOT_FOUND")
          ? "الفاتورة غير موجودة أو تم حذفها بالفعل"
          : msg.includes("PAID_INVOICE_LOCKED")
            ? "لا يمكن حذف فاتورة مدفوعة"
            : "فشل في حذف الفاتورة";
      toast({ title: "خطأ", description: friendly, variant: "destructive" });
    },
  });

  return { list, getInvoice, create, update, remove };
};
