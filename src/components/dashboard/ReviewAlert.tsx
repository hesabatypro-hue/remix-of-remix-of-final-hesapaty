import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewAlert() {
  const { currentOrganization } = useAuth();

  const { data: count = 0 } = useQuery({
    queryKey: ["review-count", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return 0;
      const { count, error } = await supabase
        .from("transfers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrganization.id)
        .eq("needs_review", true)
        .eq("is_confirmed", false)
        .eq("is_deleted", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentOrganization?.id,
  });

  if (count === 0) return null;

  return (
    <div className="mb-4 p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-warning" />
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">
            {count} تحويل بانتظار المراجعة البشرية
          </p>
          <p className="text-xs text-muted-foreground">
            تحويلات تحتاج تأكيدك قبل اعتمادها
          </p>
        </div>
      </div>
      <Link to="/review">
        <Button size="sm" variant="outline" className="gap-1 border-warning/30 text-warning hover:bg-warning/10">
          مراجعة
          <ArrowLeft className="w-3 h-3" />
        </Button>
      </Link>
    </div>
  );
}
