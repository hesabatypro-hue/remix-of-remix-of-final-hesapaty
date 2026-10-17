import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * All Green API traffic goes through the `green-api-proxy` Edge Function.
 * The API token is never read back into the browser: it is written once
 * (when the admin types it) and afterwards lives only server-side.
 */
async function callProxy<T = any>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("green-api-proxy", { body: payload });
  if (error) {
    // Surface the server-provided Arabic message when available
    let message = error.message || "فشل الاتصال بالخادم";
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      }
    } catch { /* keep default message */ }
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

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
      if (!currentOrganization?.id) throw new Error("لا توجد مؤسسة محددة");
      return await callProxy({
        action: "save",
        organizationId: currentOrganization.id,
        branchId,
        phoneNumber,
        instanceId,
        apiToken,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections"] });
      toast({
        title: "تم إضافة الربط",
        description: data?.webhookConfigured
          ? "تم حفظ بيانات Green API وإعداد Webhook المؤمَّن تلقائياً"
          : "تم حفظ بيانات Green API. يرجى الضغط على «إعادة ضبط Webhook» لإكمال التفعيل",
      });
    },
    onError: (error: Error) => {
      const message =
        error.message === "LIABILITY_NOT_ACCEPTED"
          ? "يجب الموافقة على إقرار المسؤولية قبل الربط"
          : error.message || "فشل في إضافة الربط";
      toast({ title: "خطأ", description: message, variant: "destructive" });
    },
  });

  const testGreenApiConnection = useMutation({
    mutationFn: async ({ instanceId, apiToken }: { instanceId: string; apiToken: string }) =>
      await callProxy({ action: "test", instanceId, apiToken }),
    onSuccess: () => {
      toast({ title: "الاتصال يعمل", description: "تم التحقق من صحة بيانات Green API بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "فشل الاختبار", description: error.message, variant: "destructive" });
    },
  });

  const setupGreenApiWebhook = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) =>
      await callProxy({ action: "reset_webhook", connectionId }),
    onSuccess: () => {
      toast({ title: "تم الإعداد", description: "تم إعداد Webhook المؤمَّن بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const getInstanceState = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) =>
      await callProxy({ action: "state", connectionId }),
  });

  const rebootInstance = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) =>
      await callProxy({ action: "reboot", connectionId }),
  });

  const activateConnection = useMutation({
    mutationFn: async ({ connectionId }: { connectionId: string }) =>
      await callProxy({ action: "activate", connectionId }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connections"] });
      if (data?.status === "already_connected") {
        toast({ title: "الاتصال مفعّل", description: "الرقم متصل بالفعل وجاهز لاستقبال الرسائل" });
      } else {
        toast({
          title: "جاري التفعيل",
          description: "تم إعادة تشغيل الاتصال. يرجى مسح QR Code من تطبيق Green API إذا لزم الأمر",
        });
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
