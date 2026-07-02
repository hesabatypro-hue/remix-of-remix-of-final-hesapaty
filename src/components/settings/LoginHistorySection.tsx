import { Shield, Monitor, Smartphone, Globe } from "lucide-react";
import { useLoginHistory } from "@/hooks/useLoginHistory";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

function getDeviceIcon(userAgent: string | null) {
  if (!userAgent) return <Globe className="w-4 h-4" />;
  if (/mobile|android|iphone/i.test(userAgent)) return <Smartphone className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

function getEventLabel(type: string) {
  switch (type) {
    case "login": return "تسجيل دخول";
    case "logout": return "تسجيل خروج";
    case "signup": return "تسجيل حساب";
    case "login_failed": return "محاولة فاشلة";
    default: return type;
  }
}

export function LoginHistorySection() {
  const { data: history, isLoading } = useLoginHistory(10);

  return (
    <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">سجل الدخول</h2>
          <p className="text-sm text-muted-foreground">آخر 10 عمليات دخول وخروج</p>
        </div>
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !history?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل دخول بعد</p>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${record.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {getDeviceIcon(record.user_agent)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{getEventLabel(record.event_type)}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {format(new Date(record.created_at), "dd MMM yyyy, HH:mm", { locale: ar })}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${record.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {record.success ? "ناجح" : "فاشل"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
