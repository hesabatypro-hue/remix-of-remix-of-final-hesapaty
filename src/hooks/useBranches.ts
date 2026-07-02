import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export interface Branch {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  is_active: boolean;
  organization_id: string | null;
  whatsapp_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useBranches = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, user } = useAuth();

  const { data: branches = [], isLoading, error } = useQuery({
    queryKey: ['branches', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Branch[];
    },
    enabled: !!currentOrganization?.id,
  });

  const addBranch = useMutation({
    mutationFn: async (branch: { name: string; location?: string; phone?: string; whatsapp_chat_id?: string }) => {
      if (!currentOrganization?.id) throw new Error('لا توجد مؤسسة محددة');
      
      const { data, error } = await supabase
        .from('branches')
        .insert({
          ...branch,
          organization_id: currentOrganization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', currentOrganization?.id] });
      toast({ title: "تم بنجاح", description: "تم إضافة الفرع بنجاح" });
    },
    onError: (error: any) => {
      const isLimitError = error.message?.includes('BRANCH_LIMIT_EXCEEDED');
      toast({
        title: isLimitError ? "تم الوصول للحد الأقصى" : "خطأ",
        description: isLimitError 
          ? "لقد وصلت للحد الأقصى من الفروع في خطتك الحالية. قم بترقية خطتك لإضافة المزيد."
          : "فشل في إضافة الفرع",
        variant: "destructive",
      });
    },
  });

  const updateBranch = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Branch> & { id: string }) => {
      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', currentOrganization?.id] });
      toast({ title: "تم بنجاح", description: "تم تحديث الفرع بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث الفرع", variant: "destructive" });
    },
  });

  // Soft delete instead of hard delete
  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('branches')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user?.id || null,
        } as any)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', currentOrganization?.id] });
      toast({ title: "تم بنجاح", description: "تم حذف الفرع بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف الفرع", variant: "destructive" });
    },
  });

  return { branches, isLoading, error, addBranch, updateBranch, deleteBranch };
};
