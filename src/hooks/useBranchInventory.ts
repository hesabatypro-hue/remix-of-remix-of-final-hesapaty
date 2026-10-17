import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface BranchInventoryRow {
  id: string;
  organization_id: string;
  branch_id: string;
  product_id: string;
  stock_quantity: number;
  custom_sale_price: number | null;
  low_stock_threshold: number;
  product?: {
    product_name: string;
    barcode: string | null;
    default_sale_price: number;
  };
}

export function useBranchInventory(branchId?: string) {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const inventory = useQuery({
    queryKey: ["branch-inventory", currentOrganization?.id, branchId],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      let q = supabase
        .from("branch_inventory" as any)
        .select("*, product:products(product_name, barcode, default_sale_price)")
        .eq("organization_id", currentOrganization!.id);
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as BranchInventoryRow[]) ?? [];
    },
  });

  const upsertInventory = useMutation({
    mutationFn: async (row: Partial<BranchInventoryRow> & { branch_id: string; product_id: string; stock_quantity: number }) => {
      if (!currentOrganization?.id) throw new Error("no org");
      const payload = { ...row, organization_id: currentOrganization.id };
      const { data, error } = await supabase
        .from("branch_inventory" as any)
        .upsert(payload, { onConflict: "branch_id,product_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branch-inventory"] });
      toast({ title: "تم تحديث المخزون" });
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return { inventory, upsertInventory };
}
