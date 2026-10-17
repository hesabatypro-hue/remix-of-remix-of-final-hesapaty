import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ReconciliationSource } from "../config";

export interface ReconciliationRow {
  source: ReconciliationSource;
  missingCount: number;
  missingAmount: number;
}

export interface ReconciliationResult {
  rows: ReconciliationRow[];
  totalMissingCount: number;
  totalMissingAmount: number;
  chainIntact: boolean;
  brokenAt: string | null;
  checkedAt: Date;
}

export function useLedgerReconciliation() {
  const { currentOrganization } = useAuth();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ["ledger-reconciliation", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<ReconciliationResult> => {
      const [recon, chain] = await Promise.all([
        supabase.rpc("ledger_reconciliation", { _organization_id: orgId! }),
        supabase.rpc("verify_ledger_chain", { _organization_id: orgId! }),
      ]);
      if (recon.error) throw recon.error;
      if (chain.error) throw chain.error;

      const rows: ReconciliationRow[] = (recon.data ?? []).map((r) => ({
        source: r.source as ReconciliationSource,
        missingCount: Number(r.missing_count),
        missingAmount: Number(r.missing_amount),
      }));
      const broken = chain.data?.[0];

      return {
        rows,
        totalMissingCount: rows.reduce((s, r) => s + r.missingCount, 0),
        totalMissingAmount: rows.reduce((s, r) => s + r.missingAmount, 0),
        chainIntact: !broken,
        brokenAt: broken?.broken_at_posted_at ?? null,
        checkedAt: new Date(),
      };
    },
  });
}
