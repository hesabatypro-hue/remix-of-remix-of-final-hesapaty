import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export const useGreenApiConnection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  const addGreenApiConnection = useMutation({
    mutationFn: async ({
      branchId,
      phoneNumber,
      instanceId,
      apiToken,
    }: {
      branchId: string;
      phoneNumber: string;
      instanceId: string;
      apiToken: string;
    }) => {
      if (!currentOrganization?.id) {
        throw new Error("لا توجد مؤسسة محددة");
      }

      // Insert connection without token
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .insert({
          branch_id: branchId,
          phone_number: phoneNumber,
          connection_type: "green_api",
          green_api_instance_id: instanceId,
          status: "pending",
          organization_id: currentOrganization.id,
        })
        .select("*, branches(*)")
        .single();

      if (error) throw error;

      // Insert credentials separately
      const { error: credError } = await supabase
        .from("whatsapp_credentials")
        .insert({
          connection_id: data.id,
          green_api_token: apiToken,
        });

      if (credError) throw credError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections"] });
      toast({
        title: "تم إضافة الربط",
        description: "تم حفظ بيانات Green API بنجاح وسيتم تفعيله تلقائياً",
      });
    },
    onError: (error: any) => {
      let message = "فشل في إضافة الربط";
      if (error.code === "23505") {
        message = "هذا الفرع أو الرقم مرتبط مسبقاً";
      } else if (error.message) {
        message = error.message;
      }
      toast({
        title: "خطأ",
        description: message,
        variant: "destructive",
      });
      console.error("Error adding Green API connection:", error);
    },
  });

  const testGreenApiConnection = useMutation({
    mutationFn: async ({
      instanceId,
      apiToken,
    }: {
      instanceId: string;
      apiToken: string;
    }) => {
      const response = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/getSettings/${apiToken}`
      );
      if (!response.ok) throw new Error("فشل الاتصال بـ Green API");
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "الاتصال يعمل", description: "تم التحقق من صحة بيانات Green API بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "فشل الاختبار", description: error.message, variant: "destructive" });
    },
  });

  const setupGreenApiWebhook = useMutation({
    mutationFn: async ({
      instanceId,
      apiToken,
      webhookUrl,
    }: {
      instanceId: string;
      apiToken: string;
      webhookUrl: string;
    }) => {
      const response = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/setSettings/${apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhookUrl,
            webhookUrlToken: "",
            delaySendMessagesMilliseconds: 1000,
            markIncomingMessagesReaded: "yes",
            markIncomingMessagesReadedOnReply: "yes",
            outgoingWebhook: "yes",
            outgoingMessageWebhook: "yes",
            incomingWebhook: "yes",
            deviceWebhook: "no",
          }),
        }
      );
      if (!response.ok) throw new Error("فشل إعداد Webhook");
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإعداد", description: "تم إعداد Webhook بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const getInstanceState = useMutation({
    mutationFn: async ({ instanceId, apiToken }: { instanceId: string; apiToken: string }) => {
      const response = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${apiToken}`
      );
      if (!response.ok) throw new Error("فشل جلب حالة الاتصال");
      return await response.json();
    },
  });

  const rebootInstance = useMutation({
    mutationFn: async ({ instanceId, apiToken }: { instanceId: string; apiToken: string }) => {
      const response = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/reboot/${apiToken}`
      );
      if (!response.ok) throw new Error("فشل إعادة تشغيل الاتصال");
      return await response.json();
    },
  });

  const activateConnection = useMutation({
    mutationFn: async ({
      instanceId,
      apiToken,
      connectionId,
    }: {
      instanceId: string;
      apiToken: string;
      connectionId: string;
    }) => {
      const stateResponse = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/getStateInstance/${apiToken}`
      );
      if (!stateResponse.ok) throw new Error("فشل جلب حالة الاتصال");
      const stateData = await stateResponse.json();

      if (stateData.stateInstance === "authorized") {
        await supabase
          .from("whatsapp_connections")
          .update({ status: "connected", last_sync_at: new Date().toISOString() })
          .eq("id", connectionId);
        return { status: "already_connected", state: stateData };
      }

      const rebootResponse = await fetch(
        `https://api.green-api.com/waInstance${instanceId}/reboot/${apiToken}`
      );
      if (!rebootResponse.ok) throw new Error("فشل إعادة تشغيل الاتصال");

      await supabase
        .from("whatsapp_connections")
        .update({ status: "pending" })
        .eq("id", connectionId);

      return { status: "rebooted", state: stateData };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections"] });
      if (data.status === "already_connected") {
        toast({ title: "الاتصال مفعّل", description: "الرقم متصل بالفعل وجاهز لاستقبال الرسائل" });
      } else {
        toast({ title: "جاري التفعيل", description: "تم إعادة تشغيل الاتصال. يرجى مسح QR Code من تطبيق Green API إذا لزم الأمر" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "خطأ في التفعيل", description: error.message, variant: "destructive" });
    },
  });

  return {
    addGreenApiConnection,
    testGreenApiConnection,
    setupGreenApiWebhook,
    getInstanceState,
    rebootInstance,
    activateConnection,
  };
};
