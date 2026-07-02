import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LoginRecord {
  id: string;
  event_type: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
  created_at: string;
}

export function useLoginHistory(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["login-history", user?.id, limit],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("login_history")
        .select("id, event_type, ip_address, user_agent, success, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as LoginRecord[];
    },
    enabled: !!user,
  });
}

export async function logLoginEvent(
  userId: string,
  eventType: "login" | "signup" | "logout" | "login_failed",
  success: boolean,
  metadata?: Record<string, unknown>
) {
  try {
    await (supabase as any).from("login_history").insert({
      user_id: userId,
      event_type: eventType,
      user_agent: navigator.userAgent?.substring(0, 500) || null,
      ip_address: null,
      success,
      metadata: metadata || null,
    });
  } catch (e) {
    console.error("Failed to log login event:", e);
  }
}
