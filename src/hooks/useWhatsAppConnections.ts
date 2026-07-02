import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Branch } from "./useBranches";

export interface WhatsAppConnection {
  id: string;
  branch_id: string;
  phone_number: string;
  connection_type: "meta" | "green_api" | string;
  whatsapp_business_id: string | null;
  webhook_verify_token: string | null;
  green_api_instance_id: string | null;
  meta_phone_number_id: string | null;
  status: "connected" | "pending" | "disconnected";
  last_sync_at: string | null;
  verification_code: string | null;
  verification_expires_at: string | null;
  monitored_chat_id: string | null;
  monitored_chat_name: string | null;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
  branches?: Branch;
  // Credentials (only available to owner/admin)
  credentials?: {
    access_token: string | null;
    green_api_token: string | null;
  } | null;
}

export const useWhatsAppConnections = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const orgId = currentOrganization?.id;

  const { data: connections = [], isLoading, error } = useQuery({
    queryKey: ['whatsapp-connections', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select(`*, branches(*), whatsapp_credentials(id, connection_id, access_token, green_api_token, created_at)`)
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        credentials: item.whatsapp_credentials?.[0] || item.whatsapp_credentials || null,
        whatsapp_credentials: undefined,
      })) as WhatsAppConnection[];
    },
    enabled: !!orgId,
  });

  const addConnection = useMutation({
    mutationFn: async ({ 
      branchId, 
      phoneNumber, 
      accessToken, 
      phoneNumberId 
    }: { 
      branchId: string; 
      phoneNumber: string;
      accessToken: string;
      phoneNumberId: string;
    }) => {
      // Insert connection first
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .insert({
          branch_id: branchId,
          phone_number: phoneNumber,
          whatsapp_business_id: phoneNumberId,
          webhook_verify_token: "lovable_whatsapp_verify",
          status: 'pending',
          organization_id: orgId,
        })
        .select('*, branches(*)')
        .single();
      
      if (error) throw error;

      // Insert credentials separately
      const { error: credError } = await supabase
        .from('whatsapp_credentials')
        .insert({
          connection_id: data.id,
          access_token: accessToken,
        });
      
      if (credError) throw credError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', orgId] });
      toast({ title: "تم إضافة الربط", description: "تم حفظ البيانات. قم بإعداد Webhook في Meta ثم اضغط تفعيل" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.code === '23505' ? "هذا الفرع أو الرقم مرتبط مسبقاً" : "فشل في إضافة الربط", variant: "destructive" });
    },
  });

  const updateConnectionStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WhatsAppConnection['status'] }) => {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .update({ status })
        .eq('id', id)
        .select('*, branches(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', orgId] });
      const messages: Record<string, string> = { connected: "تم الاتصال بنجاح", disconnected: "تم قطع الاتصال", pending: "جاري إعادة الاتصال" };
      toast({ title: "تم بنجاح", description: messages[variables.status] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث حالة الاتصال", variant: "destructive" });
    },
  });

  const toggleConfirmationNotifications = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .update({ notification_enabled: enabled })
        .eq('id', id)
        .select('*, branches(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', orgId] });
      toast({ title: "تم الحفظ", description: "تم تحديث إعداد رسائل التأكيد التلقائية" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل تحديث إعداد رسائل التأكيد", variant: "destructive" });
    },
  });

  const deleteConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', orgId] });
      toast({ title: "تم بنجاح", description: "تم حذف ربط WhatsApp Business بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف الربط", variant: "destructive" });
    },
  });

  const verifyConnection = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .update({ status: 'connected', last_sync_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, branches(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-connections', orgId] });
      toast({ title: "تم التحقق بنجاح", description: "تم ربط WhatsApp Business بالفرع" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في التحقق من الرقم", variant: "destructive" });
    },
  });

  const testConnection = useMutation({
    mutationFn: async (id: string) => {
      // Fetch connection
      const { data: connection, error: fetchError } = await supabase
        .from('whatsapp_connections').select('*').eq('id', id).single();
      if (fetchError || !connection) throw new Error('لم يتم العثور على الاتصال');
      
      // Fetch credentials
      const { data: creds } = await supabase
        .from('whatsapp_credentials').select('*').eq('connection_id', id).single();
      
      if (connection.connection_type === 'green_api') {
        if (!connection.green_api_instance_id || !creds?.green_api_token) throw new Error('بيانات Green API غير مكتملة');
        const response = await fetch(`https://api.green-api.com/waInstance${connection.green_api_instance_id}/getStateInstance/${creds.green_api_token}`);
        if (!response.ok) throw new Error('فشل الاتصال بـ Green API');
        const data = await response.json();
        if (data.stateInstance !== 'authorized') throw new Error(`حالة الاتصال: ${data.stateInstance || 'غير معروف'}`);
        return data;
      } else {
        if (!connection.whatsapp_business_id || !creds?.access_token) throw new Error('بيانات Meta API غير مكتملة');
        const response = await fetch(`https://graph.facebook.com/v18.0/${connection.whatsapp_business_id}`, {
          headers: { 'Authorization': `Bearer ${creds.access_token}` },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'فشل الاتصال بـ WhatsApp API');
        }
        return await response.json();
      }
    },
    onSuccess: () => {
      toast({ title: "الاتصال يعمل ✓", description: "تم التحقق من صحة الاتصال بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "فشل الاختبار", description: error.message, variant: "destructive" });
    },
  });

  return { connections, isLoading, error, addConnection, updateConnectionStatus, deleteConnection, verifyConnection, testConnection, toggleConfirmationNotifications };
};
