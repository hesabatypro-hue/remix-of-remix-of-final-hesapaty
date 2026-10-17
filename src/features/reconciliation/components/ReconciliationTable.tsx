import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOURCE_META, formatSDG } from "../config";
import type { ReconciliationRow } from "../hooks/useLedgerReconciliation";

function ReconciliationRowItem({ row }: { row: ReconciliationRow }) {
  const meta = SOURCE_META[row.source];
  if (!meta) return null;
  const Icon = meta.icon;
  const ok = row.missingCount === 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{meta.label}</p>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3">
        {ok ? (
          <span className="inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 className="w-4 h-4" />مطابق</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              {row.missingCount} ناقصة · {formatSDG(row.missingAmount)}
            </span>
            <Button asChild size="sm" variant="outline" className="gap-1">
              <Link to={meta.path}>مراجعة<ArrowLeft className="w-3 h-3" /></Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function ReconciliationTable({ rows }: { rows: ReconciliationRow[] }) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-soft divide-y divide-border">
      {rows.map((row) => <ReconciliationRowItem key={row.source} row={row} />)}
    </div>
  );
}
