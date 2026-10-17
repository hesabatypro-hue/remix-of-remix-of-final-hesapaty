import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface PrintOrder {
  id: string;
  organization_id: string;
  branch_id: string | null;
  customer_name: string;
  material_type: string;
  width: number;
  height: number;
  quantity: number;
  total_area: number;
  unit_price: number;
  total_price: number;
  file_path: string | null;
  designer_id: string | null;
  printer_id: string | null;
  status: string;
  commission_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PrintOrderInsert = {
  organization_id: string;
  branch_id?: string | null;
  customer_name: string;
  material_type: string;
  width: number;
  height: number;
  quantity: number;
  unit_price: number;
  file_path?: string | null;
  designer_id?: string | null;
  printer_id?: string | null;
  status?: string;
  commission_rate?: number;
  notes?: string | null;
};

export function usePrintOrders() {
  const { currentOrganization } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["print-orders", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("print_orders" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PrintOrder[];
    },
    enabled: !!orgId,
  });

  const addOrder = useMutation({
    mutationFn: async (order: PrintOrderInsert) => {
      const { error } = await supabase
        .from("print_orders" as any)
        .insert(order as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-orders"] });
      toast({ title: "تم إنشاء أمر التشغيل بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء أمر التشغيل", variant: "destructive" });
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("print_orders" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-orders"] });
      toast({ title: "تم تحديث حالة الطلب" });
    },
    onError: () => {
      toast({ title: "خطأ في تحديث الحالة", variant: "destructive" });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("print_orders" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print-orders"] });
      toast({ title: "تم حذف أمر التشغيل" });
    },
    onError: () => {
      toast({ title: "خطأ في حذف أمر التشغيل", variant: "destructive" });
    },
  });

  return { orders, isLoading, addOrder, updateOrderStatus, deleteOrder };
}
