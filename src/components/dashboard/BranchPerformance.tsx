import { Store, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranchesRevenue } from "@/hooks/useDashboardStats";

export function BranchPerformance() {
  const { data: branches = [], isLoading } = useBranchesRevenue();
  
  const maxRevenue = Math.max(...branches.map((b) => b.todayRevenue), 1);

  return (
    <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground">أداء الفروع</h3>
        <p className="text-sm text-muted-foreground">إيرادات اليوم حسب الفرع</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Store className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm">لا توجد فروع نشطة</p>
        </div>
      ) : (
        <div className="space-y-4">
          {branches.slice(0, 5).map((branch, index) => (
            <div
              key={branch.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground text-sm truncate max-w-[120px]">
                  {branch.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-sm">
                    {branch.todayRevenue.toLocaleString()} ج.س
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({branch.transferCount} تحويل)
                  </span>
                </div>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out",
                    branch.todayRevenue > 0 ? "gradient-primary" : "bg-muted-foreground/30"
                  )}
                  style={{
                    width: `${(branch.todayRevenue / maxRevenue) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
