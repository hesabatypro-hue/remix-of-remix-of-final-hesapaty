import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Image,
  Eye,
  Check,
  X,
  Calendar,
  Loader2,
  AlertCircle,
  Upload,
  Sparkles,
  Plus,
  RotateCcw,
  Trash2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TransfersSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  useTransfersPagination, 
  useConfirmTransfer, 
  useRejectTransfer, 
  useExtractTransferAmount,
  useCreateTransfer,
  useResetAllTransfers,
  useUpdateTransfer,
  Transfer,
  ExtractedTransferData,
} from "@/hooks/useTransfers";
import { useBranches } from "@/hooks/useBranches";
import { useSecureImage } from "@/hooks/useSecureImage";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { InlineMemoEditor } from "@/components/transfers/InlineMemoEditor";
import { StatusBadge } from "@/components/transfers/StatusBadge";
import { SwipeableTransferCard } from "@/components/transfers/SwipeableTransferCard";
import { useIsMobile } from "@/hooks/use-mobile";

function TransferDetailContent({ 
  transfer, secureImageUrl, secureImageLoading, getSecureImageUrl, setSecureImageUrl, setFullScreenImage, handleConfirm, setSelectedTransfer, setTransferToReject 
}: {
  transfer: Transfer;
  secureImageUrl: string | null;
  secureImageLoading: boolean;
  getSecureImageUrl: (id: string) => Promise<string | null>;
  setSecureImageUrl: (url: string | null) => void;
  setFullScreenImage: (url: string | null) => void;
  handleConfirm: (t: Transfer) => void;
  setSelectedTransfer: (t: Transfer | null) => void;
  setTransferToReject: (t: Transfer | null) => void;
}) {
  useEffect(() => {
    if (transfer.image_url) {
      getSecureImageUrl(transfer.id).then(setSecureImageUrl);
    }
    return () => setSecureImageUrl(null);
  }, [transfer.id]);

  return (
    <div className="space-y-4">
      {transfer.image_url ? (
        <div className="rounded-xl overflow-hidden border-2 border-primary/20 bg-muted/30">
          {secureImageLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="mr-2 text-muted-foreground">جاري تحميل الصورة بشكل آمن...</span>
            </div>
          ) : secureImageUrl ? (
            <img 
              src={secureImageUrl} 
              alt="صورة إشعار التحويل" 
              className="w-full h-auto max-h-[400px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
              onClick={() => setFullScreenImage(secureImageUrl)}
            />
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <AlertCircle className="w-5 h-5 ml-2" />
              تعذّر تحميل الصورة
            </div>
          )}
          <div className="p-2 bg-muted/50 text-center space-y-1">
            <p className="text-xs text-muted-foreground">🔍 اضغط على الصورة لعرضها بالحجم الكامل</p>
            <p className="text-xs text-muted-foreground/60">🔒 الصورة محفوظة بأمان</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <Image className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">لا توجد صورة للتحويل</p>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-xl p-4">
        <div>
          <p className="text-sm text-muted-foreground">رقم العملية</p>
          <p className="font-bold text-primary font-mono">{transfer.transaction_id || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">المبلغ</p>
          <p className="font-bold text-xl text-primary">{transfer.amount.toLocaleString()} ج.س</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">المستلم</p>
          <p className="font-medium">{transfer.receiver_account || "غير محدد"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">من حساب</p>
          <p className="font-medium">{transfer.sender_account || transfer.sender_name || "غير معروف"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">الفرع</p>
          <p className="font-medium">{transfer.branches?.name || "غير محدد"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">الحالة</p>
          <StatusBadge transfer={transfer} />
        </div>
        <div className="col-span-2">
          <p className="text-sm text-muted-foreground">البيان</p>
          <p className="font-medium">{transfer.client_memo || transfer.notes || "—"}</p>
        </div>
        {transfer.ai_confidence != null && (
          <div>
            <p className="text-sm text-muted-foreground">ثقة الذكاء الاصطناعي</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    transfer.ai_confidence >= 80 ? "bg-emerald-500" :
                    transfer.ai_confidence >= 50 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${transfer.ai_confidence}%` }}
                />
              </div>
              <span className="text-sm font-medium">{transfer.ai_confidence}%</span>
            </div>
          </div>
        )}
      </div>
      
      {!transfer.is_confirmed && (
        <div className="flex gap-2 pt-4">
          <Button className="flex-1 gap-2" onClick={() => { handleConfirm(transfer); setSelectedTransfer(null); }}>
            <Check className="w-4 h-4" />
            تأكيد التحويل
          </Button>
          <Button variant="destructive" className="flex-1 gap-2" onClick={() => { setTransferToReject(transfer); setSelectedTransfer(null); }}>
            <X className="w-4 h-4" />
            حذف
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Transfers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [transferToReject, setTransferToReject] = useState<Transfer | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedTransferData | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualSenderName, setManualSenderName] = useState<string>("");
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [secureImageUrl, setSecureImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getSecureImageUrl, loading: secureImageLoading } = useSecureImage();
  
  const { transfers, isLoading, error, totalCount, stats, page, setPage, totalPages, hasNextPage, hasPrevPage } = useTransfersPagination(searchQuery);
  const { branches } = useBranches();
  const confirmMutation = useConfirmTransfer();
  const rejectMutation = useRejectTransfer();
  const extractMutation = useExtractTransferAmount();
  const createMutation = useCreateTransfer();
  const resetAllMutation = useResetAllTransfers();
  const updateMutation = useUpdateTransfer();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const RESET_CONFIRM_WORD = "حذف";
  const isMobile = useIsMobile();
  const [hintDismissed, setHintDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("transfers_swipe_hint_seen") === "1";
  });
  useEffect(() => {
    if (!isMobile || hintDismissed) return;
    const t = setTimeout(() => {
      localStorage.setItem("transfers_swipe_hint_seen", "1");
      setHintDismissed(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [isMobile, hintDismissed]);

  const filteredTransfers = transfers.filter((transfer) => {
    const transferStatus = transfer.is_confirmed ? "confirmed" : (transfer.needs_review || !transfer.client_memo ? "pending" : "unconfirmed");
    const matchesStatus = statusFilter === "all" || transferStatus === statusFilter;
    return matchesStatus;
  });

  const handleConfirm = (transfer: Transfer) => {
    confirmMutation.mutate(transfer.id);
  };

  const handleReject = () => {
    if (transferToReject) {
      rejectMutation.mutate(transferToReject.id);
      setTransferToReject(null);
    }
  };

  const handleMemoSave = (transferId: string, memo: string) => {
    updateMutation.mutate({
      id: transferId,
      data: {
        client_memo: memo,
        is_manual_memo: true,
      },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
      
      try {
        const data = await extractMutation.mutateAsync({ imageBase64: base64 });
        setExtractedData(data);
        if (data.amount) setManualAmount(data.amount.toString());
        if (data.date) setManualDate(data.date);
        if (data.sender_name) setManualSenderName(data.sender_name);
        toast.success(`تم استخراج البيانات بنسبة ثقة ${data.confidence}%`);
      } catch (error) {
        // Error shown by mutation
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTransfer = async () => {
    if (!selectedBranch || !manualAmount) {
      toast.error("يرجى اختيار الفرع وإدخال المبلغ");
      return;
    }

    try {
      await createMutation.mutateAsync({
        branch_id: selectedBranch,
        amount: parseFloat(manualAmount),
        transfer_date: manualDate,
        sender_name: manualSenderName || undefined,
        image_url: uploadedImage || undefined,
      });
      
      resetAddDialog();
      setIsAddDialogOpen(false);
    } catch (error) {
      // Error shown by mutation
    }
  };

  const resetAddDialog = () => {
    setUploadedImage(null);
    setExtractedData(null);
    setSelectedBranch("");
    setManualAmount("");
    setManualDate(new Date().toISOString().split('T')[0]);
    setManualSenderName("");
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive font-semibold mb-2">تعذّر تحميل التحويلات</p>
            <p className="text-sm text-muted-foreground mb-4">حاول تحديث الصفحة.</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              تحديث الصفحة
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">التحويلات</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            إدارة ومراجعة جميع العمليات المالية الواردة
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة تحويل
        </Button>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "الإجمالي", value: stats.total, color: "bg-card border-border", filter: "all" },
          { label: "معلق", value: stats.pending, color: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400", filter: "pending" },
          { label: "مؤكد", value: stats.confirmed, color: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400", filter: "confirmed" },
          { label: "غير مؤكد", value: Math.max(0, stats.total - stats.pending - stats.confirmed), color: "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400", filter: "unconfirmed" },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => setStatusFilter(stat.filter)}
            className={cn(
              "p-3 rounded-xl border transition-all hover:shadow-md text-right",
              stat.color,
              statusFilter === stat.filter && "ring-2 ring-primary shadow-md"
            )}
          >
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs opacity-80">{stat.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم، رقم العملية، البيان..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 pl-9 bg-muted/50 border-0"
            />
            {isLoading && searchQuery && (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { setStatusFilter("all"); setSearchQuery(""); }}>
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة تعيين
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button 
              variant="outline" size="sm" className="gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setShowResetConfirm(true)}
              disabled={resetAllMutation.isPending || stats.total === 0}
            >
              {resetAllMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              حذف الكل
            </Button>
          </div>
        </div>
      </div>

      {/* Professional Financial Table (desktop) / Swipeable Cards (mobile) */}
      <div className={cn(isMobile ? "" : "bg-card rounded-xl border border-border/50 overflow-hidden shadow-sm")}>
        {isLoading ? (
          <TransfersSkeleton />
        ) : filteredTransfers.length === 0 ? (
          <EmptyState
            icon={Image}
            title="لا توجد تحويلات بعد"
            description="عند إرسال صور إيصالات التحويل عبر واتساب، ستظهر هنا تلقائياً."
            actionLabel="إضافة تحويل يدوياً"
            onAction={() => setIsAddDialogOpen(true)}
          />
        ) : isMobile ? (
          <div className="space-y-2.5">
            {!hintDismissed && (
              <p className="text-[11px] text-center text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg py-2 px-3">
                💡 اسحب البطاقة يميناً للتأكيد/الحذف، أو يساراً لفتح الإشعار
              </p>
            )}
            {filteredTransfers.map((transfer, index) => (
              <SwipeableTransferCard
                key={transfer.id}
                transfer={transfer}
                onOpen={() => setSelectedTransfer(transfer)}
                onConfirm={() => handleConfirm(transfer)}
                onReject={() => setTransferToReject(transfer)}
                showHint={!hintDismissed && index === 0}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-b-2 border-border bg-muted/40">
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">التاريخ والزمن</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">رقم العملية</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">المبلغ (ج.س)</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">المستلم</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap">من حساب</th>
                  <th className="text-right p-3 font-semibold text-muted-foreground whitespace-nowrap min-w-[200px]">البيان</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground whitespace-nowrap">الحالة</th>
                  <th className="text-center p-3 font-semibold text-muted-foreground whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredTransfers.map((transfer, index) => (
                  <tr
                    key={transfer.id}
                    className="hover:bg-muted/20 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <td className="p-3 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-foreground text-xs">
                          {format(new Date(transfer.transfer_date), "dd/MM/yyyy")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transfer.created_at), "HH:mm:ss")}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-bold font-mono text-primary text-xs">
                        {transfer.transaction_id || "—"}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-bold text-foreground">
                        {transfer.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-foreground text-xs">
                        {transfer.receiver_account || "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-xs">
                        <p className="text-foreground">{transfer.sender_account || transfer.sender_name || "—"}</p>
                        {transfer.sender_phone && (
                          <p className="text-muted-foreground" dir="ltr">{transfer.sender_phone}</p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <InlineMemoEditor
                        value={transfer.client_memo}
                        onSave={(memo) => handleMemoSave(transfer.id, memo)}
                        isPending={updateMutation.isPending && updateMutation.variables?.id === transfer.id}
                        isError={updateMutation.isError && updateMutation.variables?.id === transfer.id}
                      />
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge transfer={transfer} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs h-7 px-2"
                          onClick={() => setSelectedTransfer(transfer)}
                        >
                          <FileText className="w-3 h-3" />
                          فتح الإشعار
                        </Button>
                        {!transfer.is_confirmed && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              title="تأكيد"
                              onClick={() => handleConfirm(transfer)}
                              disabled={confirmMutation.isPending}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="حذف"
                              onClick={() => setTransferToReject(transfer)}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-muted-foreground">
            صفحة {page + 1} من {totalPages} ({totalCount} عملية)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={!hasPrevPage}>السابق</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!hasNextPage}>التالي</Button>
          </div>
        </div>
      )}

      {/* View Transfer Dialog */}
      <Dialog open={!!selectedTransfer} onOpenChange={(open) => { if (!open) { setSelectedTransfer(null); setSecureImageUrl(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col gap-0" dir="rtl">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0 bg-background">
            <DialogTitle className="pl-8 text-base sm:text-lg">تفاصيل العملية {selectedTransfer?.transaction_id && <span className="text-primary font-mono">#{selectedTransfer.transaction_id}</span>}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 overscroll-contain">
          {selectedTransfer && (
            <TransferDetailContent
              transfer={selectedTransfer}
              secureImageUrl={secureImageUrl}
              secureImageLoading={secureImageLoading}
              getSecureImageUrl={getSecureImageUrl}
              setSecureImageUrl={setSecureImageUrl}
              setFullScreenImage={setFullScreenImage}
              handleConfirm={handleConfirm}
              setSelectedTransfer={setSelectedTransfer}
              setTransferToReject={setTransferToReject}
            />
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={!!transferToReject} onOpenChange={() => setTransferToReject(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل تريد حذف هذا التحويل؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إخفاء التحويل من القائمة. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset All Dialog */}
      <AlertDialog open={showResetConfirm} onOpenChange={(open) => { setShowResetConfirm(open); if (!open) setResetConfirmText(""); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ هل تريد حذف جميع التحويلات؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف جميع التحويلات ({stats.total} عملية). هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              للتأكيد، اكتب كلمة <span className="font-bold text-destructive">"{RESET_CONFIRM_WORD}"</span> في الحقل أدناه:
            </Label>
            <Input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder={RESET_CONFIRM_WORD}
              className="text-center"
              autoFocus
            />
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { resetAllMutation.mutate(); setShowResetConfirm(false); setResetConfirmText(""); }}
              disabled={resetConfirmText !== RESET_CONFIRM_WORD}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              حذف الكل نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Transfer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => { if (!open) resetAddDialog(); setIsAddDialogOpen(open); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              إضافة تحويل جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all hover:border-primary hover:bg-primary/5",
                uploadedImage ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              {uploadedImage ? (
                <div className="space-y-3">
                  <img src={uploadedImage} alt="صورة التحويل" className="max-h-48 mx-auto rounded-lg" />
                  {extractMutation.isPending && (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري استخراج البيانات...</span>
                    </div>
                  )}
                  {extractedData && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>تم استخراج البيانات بنسبة ثقة {extractedData.confidence}%</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">اضغط لتغيير الصورة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="text-foreground font-medium">اضغط لرفع صورة إشعار التحويل</p>
                  <p className="text-sm text-muted-foreground">سيتم استخراج البيانات تلقائياً</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>الفرع *</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المبلغ (ج.س) *</Label>
                  <Input type="number" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>التاريخ</Label>
                  <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>اسم المرسل</Label>
                <Input value={manualSenderName} onChange={(e) => setManualSenderName(e.target.value)} placeholder="اختياري" />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button className="flex-1 gap-2" onClick={handleCreateTransfer} disabled={createMutation.isPending || !selectedBranch || !manualAmount}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                إضافة التحويل
              </Button>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>إلغاء</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Screen Image */}
      <Dialog open={!!fullScreenImage} onOpenChange={() => setFullScreenImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2" dir="rtl">
          <DialogHeader className="sr-only"><DialogTitle>عرض الصورة</DialogTitle></DialogHeader>
          {fullScreenImage && (
            <div className="flex items-center justify-center">
              <img src={fullScreenImage} alt="صورة إشعار التحويل بالحجم الكامل" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
