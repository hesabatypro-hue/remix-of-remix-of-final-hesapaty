import { CheckCircle, Clock, MoreVertical, Image, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecentTransfers } from "@/hooks/useDashboardStats";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { Link } from "react-router-dom";

const statusConfig = {
  confirmed: {
    icon: CheckCircle,
    label: "مؤكد",
    className: "text-success bg-success/10",
  },
  pending: {
    icon: Clock,
    label: "قيد المراجعة",
    className: "text-warning bg-warning/10",
  },
};

export function RecentTransfers() {
  const { data: transfers = [], isLoading } = useRecentTransfers(5);

  return (
    <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">آخر التحويلات</h3>
          <p className="text-sm text-muted-foreground">التحويلات الواردة من واتساب</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/transfers">عرض الكل</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Image className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm">لا توجد تحويلات بعد</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {transfers.map((transfer, index) => {
            const status = statusConfig[transfer.isConfirmed ? "confirmed" : "pending"];
            const StatusIcon = status.icon;
            const timeAgo = formatDistanceToNow(new Date(transfer.createdAt), {
              addSuffix: true,
              locale: ar,
            });

            return (
              <div
                key={transfer.id}
                className="p-4 hover:bg-muted/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  {/* Image indicator */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      transfer.hasImage ? "bg-primary/10" : "bg-muted"
                    )}
                  >
                    <Image
                      className={cn(
                        "w-6 h-6",
                        transfer.hasImage ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {transfer.branchName}
                    </p>
                    <p className="text-sm text-muted-foreground">{timeAgo}</p>
                  </div>

                  {/* Amount */}
                  <div className="text-left">
                    <p className="font-bold text-foreground">
                      {transfer.amount.toLocaleString()} ج.س
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        status.className
                      )}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
