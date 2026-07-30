import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export const useOrganization = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, setCurrentOrganization } = useAuth();

  const updateOrganization = useMutation({
    mutationFn: async (updates: { name?: string; logo_url?: string; industry_type?: string; investment_enabled?: boolean; invoicing_enabled?: boolean; is_pos_enabled?: boolean }) => {
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

  const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

  const uploadLogo = async (file: File): Promise<string | null> => {
    if (!currentOrganization?.id) return null;

    // 🔒 SECURITY: enforce an allow-list on the client so nothing outside
    // known-safe raster image types ever reaches the public `org-logos`
    // bucket (e.g. SVG, which can carry executable script and would be
    // served back with the browser rendering it directly if the object URL
    // is opened on its own). This mirrors the same restriction enforced at
    // the bucket level (see migration for allowed_mime_types/file_size_limit).
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      toast({
        title: "نوع ملف غير مسموح",
        description: "يُسمح فقط بصور PNG أو JPEG أو WEBP",
        variant: "destructive",
      });
      return null;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast({
        title: "حجم الملف كبير جدًا",
        description: "الحد الأقصى لحجم الشعار هو 2 ميجابايت",
        variant: "destructive",
      });
      return null;
    }

    // Derive the extension from the validated MIME type rather than trusting
    // the client-supplied filename, so a mismatched extension (e.g. a
    // renamed file) can't slip past the check above.
    const extByType: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    const fileExt = extByType[file.type];
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
