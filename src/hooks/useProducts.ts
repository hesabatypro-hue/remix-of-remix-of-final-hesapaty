import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Product {
  id: string;
  organization_id: string;
  barcode: string | null;
  product_name: string;
  cost_price: number;
  default_sale_price: number;
  category: string | null;
  is_active: boolean;
}

export function useProducts() {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: ["products", currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products" as any)
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Product[]) ?? [];
    },
  });

  const upsertProduct = useMutation({
    mutationFn: async (p: Partial<Product> & { product_name: string }) => {
      if (!currentOrganization?.id) throw new Error("no org");
      const payload = { ...p, organization_id: currentOrganization.id };
      const { data, error } = await supabase
        .from("products" as any)
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", currentOrganization?.id] });
      toast({ title: "تم الحفظ" });
    },
    onError: (e: any) =>
      toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products" as any)
        .update({ is_deleted: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", currentOrganization?.id] });
      toast({ title: "تم الحذف" });
    },
  });

  return { products, upsertProduct, deleteProduct };
}

export function useProductByBarcode() {
  const { currentOrganization } = useAuth();
  return async (barcode: string): Promise<Product | null> => {
    if (!currentOrganization?.id || !barcode) return null;
    const { data } = await supabase
      .from("products" as any)
      .select("*")
      .eq("organization_id", currentOrganization.id)
      .eq("barcode", barcode.trim())
      .eq("is_deleted", false)
      .maybeSingle();
    return (data as unknown as Product) ?? null;
  };
}
