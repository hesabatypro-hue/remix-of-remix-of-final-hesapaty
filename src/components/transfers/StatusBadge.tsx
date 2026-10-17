import { CheckCircle, Clock, AlertCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transfer } from "@/hooks/useTransfers";

// تعريف الحالات المتوافقة مع منطق الإدارة المالية الذكية
type TransferStatus = "confirmed" | "pending" | "unconfirmed" | "needs_action";

export function getTransferStatus(transfer: Transfer): TransferStatus {
  // 1. إذا تم تأكيد العملية
  if (transfer.is_confirmed) return "confirmed";
  
  // 2. إذا كانت العملية تفتقد للبيان أو تحتاج مراجعة (تظهر كـ "معلق")
  if (transfer.needs_review || !transfer.client_memo || transfer.client_memo.trim() === "") {
    return "pending";
  }
  
  // 3. إذا فشلت العملية أو تم رفضها
  if ((transfer as any).status === "failed") return "unconfirmed";
  
  // 4. حالة افتراضية
  return "needs_action";
}

const config: Record<TransferStatus, { icon: typeof CheckCircle; label: string; className: string }> = {
  confirmed: {
    icon: CheckCircle,
    label: "مؤكد",
    className: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30 border-emerald-200",
  },
  pending: {
    icon: Clock,
    label: "بانتظار البيان",
    className: "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 border-amber-200 animate-pulse-subtle",
  },
  unconfirmed: {
    icon: AlertCircle,
    label: "غير مؤكد",
    className: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30 border-red-200",
  },
  needs_action: {
    icon: HelpCircle,
    label: "يحتاج إجراء",
    className: "text-slate-700 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30 border-slate-200",
  },
};

export function StatusBadge({ transfer }: { transfer: Transfer }) {
  const status = getTransferStatus(transfer);
  const { icon: Icon, label, className } = config[status];

  return (
    <span 
      dir="rtl"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-300", 
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}
