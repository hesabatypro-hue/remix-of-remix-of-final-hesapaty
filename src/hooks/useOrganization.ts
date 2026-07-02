import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export const useOrganization = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, setCurrentOrganization } = useAuth();

  const updateOrganization = useMutation({
    mutationFn: async (updates: { name?: string; logo_url?: string; industry_type?: string; investment_enabled?: boolean; invoicing_enabled?: boolean }) => {
      if (!currentOrganization?.id) throw new Error('لا توجد مؤسسة محددة');
      
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', currentOrganization.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization', currentOrganization?.id] });
      // Update the current organization in context
      if (data) {
        setCurrentOrganization(data);
      }
      toast({
        title: "تم بنجاح",
        description: "تم تحديث بيانات المؤسسة",
      });
    },
    onError: (error) => {
      toast({
        title: "خطأ",
        description: "فشل في تحديث بيانات المؤسسة",
        variant: "destructive",
      });
      console.error('Error updating organization:', error);
    },
  });

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!currentOrganization?.id) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${currentOrganization.id}/logo.${fileExt}`;

    // Delete old logo if exists
    await supabase.storage
      .from('org-logos')
      .remove([fileName]);

    const { error: uploadError } = await supabase.storage
      .from('org-logos')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast({
        title: "خطأ",
        description: "فشل في رفع الشعار",
        variant: "destructive",
      });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('org-logos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  return {
    updateOrganization,
    uploadLogo,
  };
};
