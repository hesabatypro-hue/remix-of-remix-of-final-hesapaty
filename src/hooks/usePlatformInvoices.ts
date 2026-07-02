import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface PlatformInvoice {
  id: string;
  organization_id: string;
  plan_id: string | null;
  plan_code: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  description: string | null;
  amount_usd: number;
  tax_usd: number;
  total_usd: number;
  from_company: string;
  from_address: string;
  from_email: string;
  to_organization_name: string;
  to_email: string | null;
  status: "issued" | "paid" | "void";
  paid_at: string | null;
  payment_reference: string | null;
  payment_method: string | null;
  created_at: string;
}

export const usePlatformInvoices = () => {
  const { currentOrganization } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const orgId = currentOrganization?.id;

  const list = useQuery({
    queryKey: ["platform_invoices", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_invoices")
        .select("*")
        .eq("organization_id", orgId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data || []) as PlatformInvoice[];
    },
  });

  const getById = (id: string | undefined) =>
    useQuery({
      queryKey: ["platform_invoice", id],
      enabled: !!id,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("platform_invoices")
          .select("*")
          .eq("id", id!)
          .single();
        if (error) throw error;
        return data as PlatformInvoice;
      },
    });

  const markPaid = useMutation({
    mutationFn: async ({ id, reference, method }: { id: string; reference?: string; method?: string }) => {
      const { error } = await supabase.rpc("mark_platform_invoice_paid", {
        _invoice_id: id,
        _reference: reference || null,
        _method: method || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform_invoices", orgId] });
      toast({ title: "تم", description: "تم تعليم الفاتورة كمدفوعة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return { list, getById, markPaid };
};
