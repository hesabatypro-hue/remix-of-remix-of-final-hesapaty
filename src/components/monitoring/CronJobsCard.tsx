import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Timer } from "lucide-react";

const JOBS = [
  { name: "retry-failed-jobs", label: "إعادة محاولة المهام الفاشلة", schedule: "كل 5 دقائق" },
  { name: "cleanup-receipts", label: "تنظيف الإيصالات والملفات القديمة", schedule: "يومياً 01:00 UTC" },
];

interface CronRun {
  id: string;
  job_name: string;
  status: string;
  started_at: string;
  duration_ms: number | null;
  details: Record<string, unknown> | null;
  error_message: string | null;
}

function useCronRuns() {
  return useQuery({
    queryKey: ["cron-job-runs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("cron_job_runs")
        .select("id, job_name, status, started_at, duration_ms, details, error_message")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as CronRun[];
    },
    refetchInterval: 30000,
  });
}

const statusStyles: Record<string, { icon: typeof CheckCircle2; className: string; label: string }> = {
  success: { icon: CheckCircle2, className: "bg-success/10 text-success", label: "نجاح" },
  partial: { icon: AlertTriangle, className: "bg-warning/10 text-warning", label: "جزئي" },
  failed: { icon: XCircle, className: "bg-destructive/10 text-destructive", label: "فشل" },
};

export function CronJobsCard() {
  const { data: runs = [], isLoading } = useCronRuns();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary" />
          المهام المجدولة (آخر 24 ساعة)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          JOBS.map((job) => {
            const jobRuns = runs.filter((r) => r.job_name === job.name);
            const last = jobRuns[0];
            const ok = jobRuns.filter((r) => r.status === "success").length;
            const bad = jobRuns.filter((r) => r.status === "failed").length;
            const partial = jobRuns.filter((r) => r.status === "partial").length;
            const style = last ? statusStyles[last.status] || statusStyles.partial : null;
            const StatusIcon = style?.icon;

            return (
              <div key={job.name} className="rounded-lg border border-border p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        style?.className || "bg-muted text-muted-foreground"
                      )}
                    >
                      {StatusIcon ? <StatusIcon className="w-4 h-4" /> : <Timer className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{job.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.schedule}
                        {last
                          ? ` • آخر تشغيل ${formatDistanceToNow(new Date(last.started_at), {
                              addSuffix: true,
                              locale: ar,
                            })}`
                          : " • لم يُشغّل بعد"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px] text-success border-success/30">
                      نجاح {ok}
                    </Badge>
                    {partial > 0 && (
                      <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                        جزئي {partial}
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={cn("text-[10px]", bad > 0 && "text-destructive border-destructive/30")}
                    >
                      فشل {bad}
                    </Badge>
                  </div>
                </div>

                {last?.error_message && (
                  <p className="text-xs text-destructive mt-2 truncate">{last.error_message}</p>
                )}
                {last?.details && Object.keys(last.details).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono truncate" dir="ltr">
                    {JSON.stringify(last.details)}
                    {last.duration_ms != null ? ` • ${last.duration_ms}ms` : ""}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
