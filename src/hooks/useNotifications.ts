import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user, currentOrganization } = useAuth();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;
  const qKey = ["notifications", user?.id, orgId];

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: qKey,
    queryFn: async () => {
      if (!user?.id || !orgId) return [];
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user?.id && !!orgId,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user?.id || !orgId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("organization_id", orgId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); },
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); },
  });

  const lastNotificationId = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || !orgId) return;

    const channel = supabase
      .channel(`notifications-rt-${user.id}-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          // Only show toast if notification belongs to current org
          if (n.organization_id === orgId && lastNotificationId.current !== n.id) {
            lastNotificationId.current = n.id;
            toast({ title: n.title, description: n.message, variant: n.type === "error" ? "destructive" : "default" });
          }
          queryClient.invalidateQueries({ queryKey: qKey });
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: qKey }); }
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: qKey }); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, orgId, queryClient]);

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification };
}
