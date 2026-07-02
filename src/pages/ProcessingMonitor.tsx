import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Image,
  Loader2,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type MessageStatus = "pending" | "processed" | "failed";

function useProcessingStats() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ["processing-stats", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;

      const [messagesRes, pendingRes, processedRes, failedJobsRes, activeJobsRes] = await Promise.all([
        supabase
          .from("whatsapp_messages")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .in("message_type", ["image", "imageMessage"]),
        supabase
          .from("whatsapp_messages")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("processed", false)
          .in("message_type", ["image", "imageMessage"]),
        supabase
          .from("whatsapp_messages")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("processed", true)
          .in("message_type", ["image", "imageMessage"]),
        supabase
          .from("failed_jobs")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("status", "pending"),
        supabase
          .from("failed_jobs")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("status", "completed"),
      ]);

      return {
        total: messagesRes.count || 0,
        pending: pendingRes.count || 0,
        processed: processedRes.count || 0,
        failedPending: failedJobsRes.count || 0,
        failedCompleted: activeJobsRes.count || 0,
      };
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: 10000,
  });
}

function useRecentMessages(status: MessageStatus) {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ["processing-messages", currentOrganization?.id, status],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      let query = supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .in("message_type", ["image", "imageMessage"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (status === "pending") {
        query = query.eq("processed", false);
      } else if (status === "processed") {
        query = query.eq("processed", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: 10000,
  });
}

function useFailedJobs() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ["failed-jobs-monitor", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from("failed_jobs")
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: 10000,
  });
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageRow({ msg }: { msg: any }) {
  const timeAgo = formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: ar });
  const processedAgo = msg.processed_at
    ? formatDistanceToNow(new Date(msg.processed_at), { addSuffix: true, locale: ar })
    : null;

  return (
    <div className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        msg.processed ? "bg-success/10" : "bg-warning/10"
      )}>
        {msg.processed ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : (
          <Clock className="w-4 h-4 text-warning" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{msg.from_number}</p>
          <Badge variant={msg.processed ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
            {msg.processed ? "تمت المعالجة" : "في الانتظار"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {msg.message_type === "image" || msg.message_type === "imageMessage" ? "صورة" : msg.message_type}
          {" • "}
          {timeAgo}
          {processedAgo && ` • عولجت ${processedAgo}`}
        </p>
      </div>
      <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px]" dir="ltr">
        {msg.message_id?.substring(0, 12)}...
      </p>
    </div>
  );
}

function FailedJobRow({ job }: { job: any }) {
  const timeAgo = formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: ar });
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const { error } = await supabase
        .from("failed_jobs")
        .update({
          status: "pending",
          next_retry_at: new Date().toISOString(),
          attempts: 0,
        })
        .eq("id", job.id);

      if (error) throw error;
      toast.success("تمت إعادة الجدولة");
      queryClient.invalidateQueries({ queryKey: ["failed-jobs-monitor", currentOrganization?.id] });
    } catch {
      toast.error("فشلت إعادة المحاولة");
    } finally {
      setRetrying(false);
    }
  };

  const statusConfig: Record<string, { icon: any; label: string; className: string }> = {
    pending: { icon: Clock, label: "في الانتظار", className: "bg-warning/10 text-warning" },
    completed: { icon: CheckCircle2, label: "مكتمل", className: "bg-success/10 text-success" },
    failed: { icon: XCircle, label: "فشل نهائي", className: "bg-destructive/10 text-destructive" },
  };

  const status = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-center gap-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", status.className)}>
        <StatusIcon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{job.job_type}</p>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            محاولة {job.attempts}/{job.max_attempts}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {job.error_message || "—"} • {timeAgo}
        </p>
      </div>
      {job.status !== "completed" && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRetry}
          disabled={retrying}
          className="shrink-0"
        >
          {retrying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
}

export default function ProcessingMonitor() {
  const { data: stats, isLoading: statsLoading } = useProcessingStats();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState("all");

  const msgStatus: MessageStatus = activeTab === "pending" ? "pending" : activeTab === "processed" ? "processed" : "pending";
  const { data: messages = [], isLoading: msgsLoading } = useRecentMessages(
    activeTab === "failed" ? "pending" : (activeTab as MessageStatus)
  );
  const { data: failedJobs = [], isLoading: jobsLoading } = useFailedJobs();

  // Realtime subscription
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel("processing-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `organization_id=eq.${currentOrganization.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["processing-stats", currentOrganization.id] });
        queryClient.invalidateQueries({ queryKey: ["processing-messages", currentOrganization.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "failed_jobs", filter: `organization_id=eq.${currentOrganization.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["processing-stats", currentOrganization.id] });
        queryClient.invalidateQueries({ queryKey: ["failed-jobs-monitor", currentOrganization.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentOrganization?.id, queryClient]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">مراقبة المعالجة</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">تتبع حالة صور الإيصالات الواردة من واتساب — يتم التحديث تلقائياً</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["processing-stats"] });
              queryClient.invalidateQueries({ queryKey: ["processing-messages"] });
              queryClient.invalidateQueries({ queryKey: ["failed-jobs-monitor"] });
            }}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            تحديث
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={MessageCircle} label="إجمالي الصور" value={stats?.total || 0} color="primary" />
          <StatCard icon={Clock} label="في الانتظار" value={stats?.pending || 0} color="warning" />
          <StatCard icon={CheckCircle2} label="تمت المعالجة" value={stats?.processed || 0} color="success" />
          <StatCard icon={AlertTriangle} label="مهام فاشلة" value={stats?.failedPending || 0} color="destructive" />
          <StatCard icon={Activity} label="مهام مكتملة" value={stats?.failedCompleted || 0} color="muted" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="pending" className="gap-1.5">
              <Clock className="w-4 h-4" />
              في الانتظار
              {(stats?.pending || 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mr-1">{stats?.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed" className="gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              تمت المعالجة
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              المهام الفاشلة
              {(stats?.failedPending || 0) > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 mr-1">{stats?.failedPending}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">الرسائل في انتظار المعالجة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">لا توجد رسائل معلقة — كل شيء تمت معالجته ✓</p>
                  </div>
                ) : (
                  messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processed">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">الرسائل المعالجة مؤخراً</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Image className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">لم تتم معالجة أي صور بعد</p>
                    <p className="text-xs mt-1 opacity-70">ستظهر هنا بمجرد إرسال صور إيصالات عبر واتساب</p>
                  </div>
                ) : (
                  messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failed">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">المهام الفاشلة وإعادة المحاولة</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {jobsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : failedJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">لا توجد مهام فاشلة — النظام يعمل بكفاءة ✓</p>
                  </div>
                ) : (
                  failedJobs.map((job) => <FailedJobRow key={job.id} job={job} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
