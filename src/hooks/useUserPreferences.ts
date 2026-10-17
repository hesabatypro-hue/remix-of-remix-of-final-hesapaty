import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface UserPreferences {
  notifications_enabled: boolean;
  email_alerts_enabled: boolean;
  dark_mode: boolean;
}

const defaults: UserPreferences = {
  notifications_enabled: true,
  email_alerts_enabled: true,
  dark_mode: false,
};

export function useUserPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences = defaults, isLoading } = useQuery({
    queryKey: ["user-preferences", user?.id],
    queryFn: async () => {
      if (!user) return defaults;
      const { data, error } = await supabase
        .from("user_preferences")
        .select("notifications_enabled, email_alerts_enabled, dark_mode")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? defaults;
    },
    enabled: !!user,
  });

  const updatePreferences = useMutation({
    mutationFn: async (updates: Partial<UserPreferences>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
      toast({ title: "تم الحفظ", description: "تم حفظ التفضيلات بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ التفضيلات", variant: "destructive" });
    },
  });

  return { preferences, isLoading, updatePreferences };
}
