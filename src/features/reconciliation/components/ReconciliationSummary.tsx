import { ShieldCheck, ShieldAlert, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSDG } from "../config";
import type { ReconciliationResult } from "../hooks/useLedgerReconciliation";

function SummaryCard({ ok, icon: Icon, title, detail }: { ok: boolean; icon: typeof ShieldCheck; title: string; detail: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", ok ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30")}>
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", ok ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export function ReconciliationSummary({ result }: { result: ReconciliationResult }) {
  const balanced = result.totalMissingCount === 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SummaryCard
        ok={balanced}
        icon={balanced ? ShieldCheck : ShieldAlert}
        title={balanced ? "السجل مطابق بالكامل" : `${result.totalMissingCount} عملية غير مسجلة`}
        detail={balanced ? "كل العمليات المالية مسجلة في السجل" : `بقيمة ${formatSDG(result.totalMissingAmount)}`}
      />
      <SummaryCard
        ok={result.chainIntact}
        icon={result.chainIntact ? Link2 : Link2Off}
        title={result.chainIntact ? "السجل سليم ولم يُعبث به" : "تم اكتشاف تلاعب في السجل"}
        detail={result.chainIntact ? "سلسلة التوقيعات متصلة" : `أول خلل بتاريخ ${new Date(result.brokenAt!).toLocaleString("ar")}`}
      />
    </div>
  );
}
