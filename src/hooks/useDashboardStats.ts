import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { startOfDay, startOfWeek, startOfMonth, endOfMonth, subMonths, parse } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchAccess } from "@/hooks/useBranchAccess";

// Auto-refresh interval (10 seconds)
const REFETCH_INTERVAL = 10000;

export type TimePeriod = "today" | "week" | "month" | "last_month" | "custom" | "all";

export interface DashboardStats {
  totalRevenue: number;
  periodRevenue: number;
  activeBranches: number;
  totalBranches: number;
  totalTransfers: number;
  periodTransfers: number;
  pendingTransfers: number;
  confirmedTransfers: number;
}

export interface DashboardFilters {
  timePeriod: TimePeriod;
  branchId: string;
  customMonth?: string; // YYYY-MM
}

function getDateRange(period: TimePeriod, customMonth?: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  switch (period) {
    case "today":
      return { start: startOfDay(now), end: null };
    case "week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: null };
    case "month":
      return { start: startOfMonth(now), end: null };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "custom": {
      if (!customMonth) return { start: startOfMonth(now), end: null };
      const d = parse(customMonth, "yyyy-MM", new Date());
      return { start: startOfMonth(d), end: endOfMonth(d) };
    }
    case "all":
    default:
      return { start: null, end: null };
  }
}

export function useDashboardStats(filters?: DashboardFilters) {
  const { timePeriod = "all", branchId = "all", customMonth } = filters || {};
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const { restrictedBranchId } = useBranchAccess();
  
  // If user is restricted to a branch, override the filter
  const effectiveBranchId = restrictedBranchId || branchId;

  // Set up realtime subscription for transfers scoped to current org
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const orgId = currentOrganization.id;
    const channel = supabase
      .channel(`dashboard-stats-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transfers', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["branches-revenue"] });
          queryClient.invalidateQueries({ queryKey: ["recent-transfers"] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branches', filter: `organization_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
          queryClient.invalidateQueries({ queryKey: ["branches-revenue"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, currentOrganization?.id]);

  return useQuery({
    queryKey: ["dashboard-stats", timePeriod, customMonth, effectiveBranchId, currentOrganization?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentOrganization?.id) {
        return {
          totalRevenue: 0,
          periodRevenue: 0,
          activeBranches: 0,
          totalBranches: 0,
          totalTransfers: 0,
          periodTransfers: 0,
          pendingTransfers: 0,
          confirmedTransfers: 0,
        };
      }
      
      const { start: periodStart, end: periodEnd } = getDateRange(timePeriod, customMonth);
      
      // Get branches count for this organization
      const { data: branches, error: branchesError } = await supabase
        .from("branches")
        .select("id, is_active")
        .eq("organization_id", currentOrganization.id);
      
      if (branchesError) throw branchesError;
      
      // Build transfers queries — run in parallel for performance
      let allTransfersQuery = supabase
        .from("transfers")
        .select("amount, is_confirmed, created_at, branch_id")
        .eq("organization_id", currentOrganization.id)
        .eq("is_deleted", false);

      if (effectiveBranchId !== "all") {
        allTransfersQuery = allTransfersQuery.eq("branch_id", effectiveBranchId);
      }

      // Server-side period filtering — avoids loading all rows into JS memory
      let periodQuery = supabase
        .from("transfers")
        .select("amount, is_confirmed, created_at, branch_id")
        .eq("organization_id", currentOrganization.id)
        .eq("is_deleted", false);

      if (effectiveBranchId !== "all") {
        periodQuery = periodQuery.eq("branch_id", effectiveBranchId);
      }
      if (periodStart) {
        periodQuery = periodQuery.gte("created_at", periodStart.toISOString());
      }
      if (periodEnd) {
        periodQuery = periodQuery.lte("created_at", periodEnd.toISOString());
      }

      const [
        { data: allTransfers, error: allTransfersError },
        { data: periodTransfersData, error: periodTransfersError },
      ] = await Promise.all([allTransfersQuery, periodQuery]);

      if (allTransfersError) throw allTransfersError;
      if (periodTransfersError) throw periodTransfersError;

      const periodTransfers = periodTransfersData || [];
      
      const activeBranches = branches?.filter(b => b.is_active).length || 0;
      const totalBranches = branches?.length || 0;
      const totalTransfers = allTransfers?.length || 0;
      const periodTransfersCount = periodTransfers.length;
      const pendingTransfers = periodTransfers.filter(t => !t.is_confirmed).length;
      const confirmedTransfers = periodTransfers.filter(t => t.is_confirmed).length;
      const totalRevenue = allTransfers?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const periodRevenue = periodTransfers.reduce((sum, t) => sum + Number(t.amount), 0);
      
      return {
        totalRevenue,
        periodRevenue,
        activeBranches,
        totalBranches,
        totalTransfers,
        periodTransfers: periodTransfersCount,
        pendingTransfers,
        confirmedTransfers,
      };
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 5000,
  });
}

export interface BranchRevenue {
  id: string;
  name: string;
  todayRevenue: number;
  transferCount: number;
}

export function useBranchesRevenue() {
  const { currentOrganization } = useAuth();
  
  return useQuery({
    queryKey: ["branches-revenue", currentOrganization?.id],
    queryFn: async (): Promise<BranchRevenue[]> => {
      if (!currentOrganization?.id) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get all active branches for this organization
      const { data: branches, error: branchesError } = await supabase
        .from("branches")
        .select("id, name")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true);
      
      if (branchesError) throw branchesError;
      
      // Get today's transfers grouped by branch for this organization
      const { data: transfers, error: transfersError } = await supabase
        .from("transfers")
        .select("branch_id, amount")
        .eq("organization_id", currentOrganization.id)
        .eq("is_deleted", false)
        .gte("transfer_date", today);
      
      if (transfersError) throw transfersError;
      
      // Calculate revenue per branch
      const branchRevenueMap = new Map<string, { revenue: number; count: number }>();
      transfers?.forEach(t => {
        const current = branchRevenueMap.get(t.branch_id) || { revenue: 0, count: 0 };
        branchRevenueMap.set(t.branch_id, {
          revenue: current.revenue + Number(t.amount),
          count: current.count + 1,
        });
      });
      
      return branches?.map(branch => ({
        id: branch.id,
        name: branch.name,
        todayRevenue: branchRevenueMap.get(branch.id)?.revenue || 0,
        transferCount: branchRevenueMap.get(branch.id)?.count || 0,
      })).sort((a, b) => b.todayRevenue - a.todayRevenue) || [];
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 5000,
  });
}

export interface RecentTransfer {
  id: string;
  branchName: string;
  amount: number;
  createdAt: string;
  isConfirmed: boolean;
  hasImage: boolean;
}

export function useRecentTransfers(limit = 5) {
  const { currentOrganization } = useAuth();
  
  return useQuery({
    queryKey: ["recent-transfers", limit, currentOrganization?.id],
    queryFn: async (): Promise<RecentTransfer[]> => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from("transfers")
        .select(`
          id,
          amount,
          created_at,
          is_confirmed,
          image_url,
          branches (name)
        `)
        .eq("organization_id", currentOrganization.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return data?.map(t => ({
        id: t.id,
        branchName: t.branches?.name || "غير محدد",
        amount: Number(t.amount),
        createdAt: t.created_at,
        isConfirmed: t.is_confirmed,
        hasImage: !!t.image_url,
      })) || [];
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: REFETCH_INTERVAL,
    staleTime: 5000,
  });
}
