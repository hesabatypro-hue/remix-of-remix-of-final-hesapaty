import { useState } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo } from "framer-motion";
import { Check, X, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Transfer } from "@/hooks/useTransfers";
import { StatusBadge } from "@/components/transfers/StatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  transfer: Transfer;
  onOpen: () => void;
  onConfirm: () => void;
  onReject: () => void;
  showHint?: boolean;
}

const THRESHOLD = 70;
const MAX = 140;

export function SwipeableTransferCard({ transfer, onOpen, onConfirm, onReject, showHint }: Props) {
  const x = useMotionValue(0);
  const [snapped, setSnapped] = useState<0 | 1 | -1>(0); // 0 idle, 1 right (open), -1 left (actions)

  // In RTL: dragging right (positive x) reveals LEFT-side bg (actions for unconfirmed)
  //         dragging left (negative x) reveals RIGHT-side bg (open)
  // Background opacity tied to motion
  const leftBgOpacity = useTransform(x, [0, MAX], [0, 1]);
  const rightBgOpacity = useTransform(x, [-MAX, 0], [1, 0]);

  const canAct = !transfer.is_confirmed;

  const handleDragEnd = (_: any, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > THRESHOLD || velocity > 500) {
      if (canAct) {
        animate(x, MAX, { type: "spring", stiffness: 400, damping: 35 });
        setSnapped(1);
      } else {
        animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
        setSnapped(0);
      }
    } else if (offset < -THRESHOLD || velocity < -500) {
      animate(x, -MAX, { type: "spring", stiffness: 400, damping: 35 });
      setSnapped(-1);
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
      setSnapped(0);
    }
  };

  const resetSwipe = () => {
    animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
    setSnapped(0);
  };

  const handleAction = (fn: () => void) => {
    resetSwipe();
    setTimeout(fn, 150);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Left background (revealed when dragging right in RTL) — Action buttons */}
      {canAct && (
        <motion.div
          style={{ opacity: leftBgOpacity }}
          className="absolute inset-y-0 right-0 flex items-center gap-2 pr-4"
        >
          <button
            onClick={() => handleAction(onConfirm)}
            className="h-12 w-12 rounded-full bg-emerald-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
            aria-label="تأكيد"
          >
            <Check className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleAction(onReject)}
            className="h-12 w-12 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
            aria-label="حذف"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Right background (revealed when dragging left in RTL) — Open */}
      <motion.div
        style={{ opacity: rightBgOpacity }}
        className="absolute inset-y-0 left-0 flex items-center pl-4"
      >
        <button
          onClick={() => handleAction(onOpen)}
          className="h-12 px-4 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 active:scale-95 transition"
        >
          <FileText className="w-4 h-4" />
          <span className="text-sm font-medium">فتح</span>
        </button>
      </motion.div>

      {/* Foreground card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -MAX, right: canAct ? MAX : 0 }}
        dragElastic={0.15}
        style={{ x }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (snapped !== 0) resetSwipe();
          else onOpen();
        }}
        className="relative bg-card p-4 cursor-pointer touch-pan-y select-none"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-xl font-bold text-foreground">
                {transfer.amount.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">ج.س</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {transfer.sender_account || transfer.sender_name || "غير معروف"}
            </p>
          </div>
          <StatusBadge transfer={transfer} />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{format(new Date(transfer.transfer_date), "dd/MM/yyyy")}</span>
            <span className="opacity-50">•</span>
            <span>{format(new Date(transfer.created_at), "HH:mm")}</span>
          </div>
          {transfer.transaction_id && (
            <span className="font-mono text-primary text-[10px] truncate max-w-[100px]" dir="ltr">
              #{transfer.transaction_id}
            </span>
          )}
        </div>

        {(transfer.client_memo || transfer.notes) && (
          <p className="text-xs text-foreground/70 mt-2 truncate border-t border-border/40 pt-2">
            {transfer.client_memo || transfer.notes}
          </p>
        )}

        {showHint && (
          <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
            <motion.div
              animate={{ x: [0, -8, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="flex items-center gap-0.5 text-primary/60"
            >
              <ChevronLeft className="w-4 h-4" />
              <ChevronLeft className="w-4 h-4 -mr-2" />
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
