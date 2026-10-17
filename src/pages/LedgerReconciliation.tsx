import { Loader2, RefreshCw, Lock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useLedgerReconciliation,
  ReconciliationSummary,
  ReconciliationTable,
  RECONCILIATION_ROLES,
} from "@/features/reconciliation";

export default function LedgerReconciliation() {
  const { currentRole } = useAuth();
  const allowed = !!currentRole && (RECONCILIATION_ROLES as readonly string[]).includes(currentRole.role);
  const { data, isLoading, isFetching, error, refetch } = useLedgerReconciliation();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">فحص المطابقة</h1>
            <p className="text-sm text-muted-foreground">التأكد من أن كل عملية مالية مسجلة في السجل المالي</p>
          </div>
          {allowed && (
            <Button onClick={() => refetch()} disabled={isFetching} variant="outline" className="gap-2">
              <RefreshCw className={isFetching ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
              إعادة الفحص
            </Button>
          )}
        </div>

        {!allowed ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <Lock className="w-10 h-10 mb-3" />
            <p>هذه الصفحة متاحة للمالك والمدير فقط</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : error || !data ? (
          <p className="text-center text-destructive py-16">تعذر تنفيذ الفحص، حاول مرة أخرى</p>
        ) : (
          <>
            <ReconciliationSummary result={data} />
            <ReconciliationTable rows={data.rows} />
            <p className="text-xs text-muted-foreground text-center">
              آخر فحص: {data.checkedAt.toLocaleString("ar")}
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
