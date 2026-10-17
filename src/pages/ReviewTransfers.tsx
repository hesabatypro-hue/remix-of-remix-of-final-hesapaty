import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Loader2,
  Image,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { useConfirmTransfer, useRejectTransfer } from "@/hooks/useTransfers";
import { useSecureImage } from "@/hooks/useSecureImage";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

const FRAUD_FLAG_LABELS: Record<string, string> = {
  image_too_small: "صورة صغيرة جداً",
  image_unusually_large: "صورة كبيرة بشكل غير طبيعي",
  duplicate_image_hash: "صورة مكررة",
  high_velocity_sender: "إرسال متكرر جداً",
  moderate_velocity_sender: "إرسال متكرر",
  very_round_amount: "مبلغ مدور",
  repeated_same_amount_today: "نفس المبلغ مكرر اليوم",
  future_date_detected: "تاريخ مستقبلي",
  old_date_detected: "تاريخ قديم",
  low_ai_confidence: "ثقة AI منخفضة",
  exif_stripped: "بيانات الصورة محذوفة",
};

function fraudFlagLabel(flag: string): string {
  return FRAUD_FLAG_LABELS[flag] || flag;
}

function useReviewTransfers() {
  const { currentOrganization } = useAuth();

  return useQuery({
    queryKey: ["review-transfers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data, error } = await supabase
        .from("transfers")
        .select("*, branches (name)")
        .eq("organization_id", currentOrganization.id)
        .eq("needs_review", true)
        .eq("is_confirmed", false)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
  });
}

function ReviewCard({
  transfer,
  onApprove,
  onReject,
  onView,
  isApproving,
  isRejecting,
}: {
  transfer: any;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onView: (t: any) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const confidence = transfer.ai_confidence ?? 0;
  const confidenceColor =
    confidence >= 80
      ? "text-success"
      : confidence >= 50
      ? "text-warning"
      : "text-destructive";

  return (
    <Card className="overflow-hidden border-warning/30 bg-warning/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-foreground">
              {transfer.branches?.name || "فرع غير محدد"}
            </span>
          </div>
          <Badge variant="outline" className="text-warning border-warning/50 text-xs">
            يحتاج مراجعة
          </Badge>
        </div>

        {/* Amount & Date */}
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-foreground">
            {Number(transfer.amount).toLocaleString()} ج.س
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(transfer.created_at), "dd MMM yyyy - HH:mm", { locale: ar })}
          </p>
        </div>

        {/* AI Confidence */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">ثقة الذكاء الاصطناعي</span>
            <span className={cn("font-bold", confidenceColor)}>{confidence}%</span>
          </div>
          <Progress value={confidence} className="h-2" />
        </div>

        {/* Fraud Detection Info */}
        {(transfer.fraud_score > 0 || (transfer.fraud_flags && transfer.fraud_flags.length > 0)) && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                <span className="font-semibold text-destructive">مؤشر الاحتيال</span>
              </div>
              <span className={cn(
                "font-bold text-sm",
                transfer.fraud_score >= 70 ? "text-destructive" :
                transfer.fraud_score >= 40 ? "text-warning" : "text-muted-foreground"
              )}>
                {transfer.fraud_score}/100
              </span>
            </div>
            <Progress value={transfer.fraud_score} className="h-1.5" />
            {transfer.fraud_flags && transfer.fraud_flags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {(transfer.fraud_flags as string[]).map((flag: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-destructive/30 text-destructive bg-destructive/5">
                    {fraudFlagLabel(flag)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sender info */}
        {transfer.sender_name && (
          <p className="text-sm text-muted-foreground">
            المرسل: <span className="text-foreground">{transfer.sender_name}</span>
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="success"
            className="flex-1"
            onClick={() => onApprove(transfer.id)}
            disabled={isApproving || isRejecting}
          >
            {isApproving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            قبول
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onReject(transfer.id)}
            disabled={isApproving || isRejecting}
          >
            {isRejecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            رفض
          </Button>
          {transfer.image_url && (
            <Button size="sm" variant="outline" onClick={() => onView(transfer)}>
              <Eye className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ImagePreviewDialog({
  transfer,
  open,
  onClose,
}: {
  transfer: any;
  open: boolean;
  onClose: () => void;
}) {
  const { getSecureImageUrl, loading } = useSecureImage();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useState(() => {
    if (transfer?.id && open) {
      getSecureImageUrl(transfer.id).then(setImageUrl);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setImageUrl(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>صورة الإيصال</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center min-h-[200px]">
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          ) : imageUrl ? (
            <img src={imageUrl} alt="إيصال" className="max-w-full max-h-[60vh] rounded-lg" />
          ) : (
            <p className="text-muted-foreground">لا يمكن تحميل الصورة</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReviewTransfers() {
  const { data: transfers = [], isLoading } = useReviewTransfers();
  const confirmMutation = useConfirmTransfer();
  const rejectMutation = useRejectTransfer();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuth();

  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    await confirmMutation.mutateAsync(id);
    queryClient.invalidateQueries({ queryKey: ["review-transfers", currentOrganization?.id] });
    setApprovingId(null);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    await rejectMutation.mutateAsync(rejectTarget);
    queryClient.invalidateQueries({ queryKey: ["review-transfers", currentOrganization?.id] });
    setRejectTarget(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">المراجعة البشرية</h1>
            <p className="text-sm text-muted-foreground">
              {transfers.length} تحويل بانتظار المراجعة
            </p>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="لا توجد تحويلات للمراجعة"
            description="جميع التحويلات تمت معالجتها بنجاح"
          />
        ) : (
          <div className="space-y-4">
            {transfers.map((transfer) => (
              <ReviewCard
                key={transfer.id}
                transfer={transfer}
                onApprove={handleApprove}
                onReject={(id) => setRejectTarget(id)}
                onView={setSelectedTransfer}
                isApproving={approvingId === transfer.id}
                isRejecting={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image Preview */}
      <ImagePreviewDialog
        transfer={selectedTransfer}
        open={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
      />

      {/* Reject Confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الرفض</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رفض هذا التحويل؟ سيتم حذفه من القائمة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground"
            >
              رفض التحويل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
