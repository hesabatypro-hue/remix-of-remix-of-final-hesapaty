import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, RefreshCw, MessageCircle } from "lucide-react";

interface LogRow {
  id: string;
  connection_id: string;
  organization_id: string;
  transfer_id: string | null;
  recipient_phone: string | null;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
}

export default function WhatsAppConfirmationLog() {
  const { currentOrganization } = useAuth();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp_notification_log", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_notification_log")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as LogRow[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`wa_conf_log_${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_notification_log",
          filter: `organization_id=eq.${orgId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["whatsapp_notification_log", orgId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  const sentCount = data?.filter((r) => r.status === "sent").length ?? 0;
  const failedCount = data?.filter((r) => r.status === "failed").length ?? 0;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <h1 className="text-xl font-bold">سجل رسائل تأكيد واتساب</h1>
              <p className="text-xs text-muted-foreground">تحديث لحظي عبر الاتصال بقاعدة البيانات</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">الإجمالي</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{data?.length ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-success">تم الإرسال</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold text-success">{sentCount}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive">فشل</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold text-destructive">{failedCount}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">المحاولات الأخيرة (200)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !data || data.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                لا توجد محاولات إرسال بعد. فعّل الميزة من صفحة إعدادات واتساب لبدء التتبع.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الوقت</TableHead>
                      <TableHead>الرقم / المجموعة</TableHead>
                      <TableHead>معرّف التحويل</TableHead>
                      <TableHead>سبب الخطأ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.status === "sent" ? (
                            <Badge variant="outline" className="gap-1 text-success border-success/30">
                              <CheckCircle2 className="w-3 h-3" /> تم
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                              <XCircle className="w-3 h-3" /> فشل
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(row.created_at), "dd MMM yyyy HH:mm:ss", { locale: ar })}
                        </TableCell>
                        <TableCell className="text-xs" dir="ltr">
                          {row.recipient_phone || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono" dir="ltr">
                          {row.transfer_id ? row.transfer_id.slice(0, 8) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-destructive max-w-[300px] truncate" title={row.error_message ?? ""}>
                          {row.error_message || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
