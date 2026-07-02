import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CreditProfile {
  id: string;
  organization_id: string;
  user_id: string;
  credit_limit: number;
  monthly_spend: number;
  monthly_payment: number;
  monthly_income_goal: number;
  current_balance: number;
  currency: string;
}

export interface Investment {
  id: string;
  organization_id: string;
  user_id: string;
  asset_name: string;
  capital_amount: number;
  expected_monthly_roi: number;
  is_active: boolean;
  notes: string | null;
  start_date: string;
  created_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  target_amount: number | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
}

export function useInvestmentOrchestrator() {
  const { user, currentOrganization } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const profileQ = useQuery({
    queryKey: ["credit-profile", orgId, user?.id],
    enabled: !!orgId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_credit_profiles")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as CreditProfile | null;
    },
  });

  const investmentsQ = useQuery({
    queryKey: ["investments", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_logs")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Investment[];
    },
  });

  const milestonesQ = useQuery({
    queryKey: ["milestones", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_milestones")
        .select("*")
        .eq("organization_id", orgId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Milestone[];
    },
  });

  const upsertProfile = useMutation({
    mutationFn: async (input: Partial<CreditProfile>) => {
      if (!orgId || !user?.id) throw new Error("No organization");
      const payload = {
        organization_id: orgId,
        user_id: user.id,
        credit_limit: Number(input.credit_limit ?? 0),
        monthly_spend: Number(input.monthly_spend ?? 0),
        monthly_payment: Number(input.monthly_payment ?? 0),
        monthly_income_goal: Number(input.monthly_income_goal ?? 0),
        current_balance: Number(input.current_balance ?? 0),
        currency: input.currency ?? "SDG",
      };
      const { error } = await supabase
        .from("user_credit_profiles")
        .upsert(payload, { onConflict: "organization_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit-profile", orgId] });
      toast.success("تم حفظ الملف الائتماني");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addInvestment = useMutation({
    mutationFn: async (input: { asset_name: string; capital_amount: number; expected_monthly_roi: number; notes?: string }) => {
      if (!orgId || !user?.id) throw new Error("No organization");
      const { error } = await supabase.from("investment_logs").insert({
        organization_id: orgId,
        user_id: user.id,
        asset_name: input.asset_name,
        capital_amount: input.capital_amount,
        expected_monthly_roi: input.expected_monthly_roi,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments", orgId] });
      toast.success("تمت إضافة الاستثمار");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleInvestment = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("investment_logs").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments", orgId] }),
  });

  const deleteInvestment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investment_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments", orgId] });
      toast.success("تم حذف الاستثمار");
    },
  });

  const addMilestone = useMutation({
    mutationFn: async (input: { title: string; target_amount?: number }) => {
      if (!orgId || !user?.id) throw new Error("No organization");
      const { error } = await supabase.from("financial_milestones").insert({
        organization_id: orgId,
        user_id: user.id,
        title: input.title,
        target_amount: input.target_amount ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", orgId] }),
  });

  const toggleMilestone = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from("financial_milestones")
        .update({ is_completed, completed_at: is_completed ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", orgId] }),
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones", orgId] }),
  });

  return {
    profile: profileQ.data ?? null,
    profileLoading: profileQ.isLoading,
    investments: investmentsQ.data ?? [],
    investmentsLoading: investmentsQ.isLoading,
    milestones: milestonesQ.data ?? [],
    milestonesLoading: milestonesQ.isLoading,
    upsertProfile,
    addInvestment,
    toggleInvestment,
    deleteInvestment,
    addMilestone,
    toggleMilestone,
    deleteMilestone,
  };
}
