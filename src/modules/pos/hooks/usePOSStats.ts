import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface POSStats {
  todayRevenue: number;
  todayInvoices: number;
  pendingInvoices: number;
  confirmedInvoices: number;
  productsCount: number;
  lowStockCount: number;
  activeBranches: number;
}

export function usePOSStats() {
  const { currentOrganization } = useAuth();

  return useQuery<POSStats>({
    queryKey: ["pos-stats", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const orgId = currentOrganization!.id;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [invRes, prodRes, invSumRes, branchRes] = await Promise.all([
        supabase
          .from("pos_invoices" as any)
          .select("total_amount,status,created_at")
          .eq("organization_id", orgId)
          .gte("created_at", startOfDay.toISOString()),
        supabase
          .from("products" as any)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_deleted", false),
        supabase
          .from("branch_inventory" as any)
          .select("quantity,low_stock_threshold,branch_id")
          .eq("organization_id", orgId),
        supabase
          .from("branches")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_active", true),
      ]);

      const todayInv = (invRes.data as any[]) ?? [];
      const todayRevenue = todayInv
        .filter((i) => i.status === "confirmed")
        .reduce((s, i) => s + Number(i.total_amount || 0), 0);
      const todayInvoices = todayInv.length;
      const pendingInvoices = todayInv.filter((i) => i.status === "pending_image").length;
      const confirmedInvoices = todayInv.filter((i) => i.status === "confirmed").length;

      const stockRows = (invSumRes.data as any[]) ?? [];
      const lowStockCount = stockRows.filter(
        (r) => Number(r.quantity) <= Number(r.low_stock_threshold ?? 0),
      ).length;

      return {
        todayRevenue,
        todayInvoices,
        pendingInvoices,
        confirmedInvoices,
        productsCount: prodRes.count ?? 0,
        lowStockCount,
        activeBranches: branchRes.count ?? 0,
      };
    },
  });
}
