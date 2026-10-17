import React, { useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Building2,
  Hash,
  User,
  StickyNote,
  DollarSign,
  Edit3,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { ExtractedReceiptData } from '../types';

interface VerificationCardProps {
  data: ExtractedReceiptData;
  previewUrl?: string | null;
  isSaving: boolean;
  onConfirm: (payload: {
    amount: number;
    transactionId?: string | null;
    senderName?: string | null;
    memo?: string | null;
  }) => void;
  onRetake: () => void;
}

const QUICK_TAGS = ['محلي', 'سفري', 'توصيل', 'طاولة 1', 'طاولة 2', 'طلب مستعجل'];

export const VerificationCard: React.FC<VerificationCardProps> = ({
  data,
  previewUrl,
  isSaving,
  onConfirm,
  onRetake,
}) => {
  const [amount, setAmount] = useState<string>(
    data.amount !== null && data.amount !== undefined ? String(data.amount) : ''
  );
  const [transactionId, setTransactionId] = useState<string>(data.transaction_id || '');
  const [senderName, setSenderName] = useState<string>(data.sender_name || '');
  const [memo, setMemo] = useState<string>('');
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0;

  const handleCopyRef = () => {
    if (transactionId) {
      navigator.clipboard.writeText(transactionId);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleConfirm = () => {
    if (!isValid || isSaving) return;
    onConfirm({
      amount: numericAmount,
      transactionId: transactionId.trim() || null,
      senderName: senderName.trim() || null,
      memo: memo.trim() || null,
    });
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 bg-[#0B0F17]/95 backdrop-blur-3xl border-t border-emerald-500/20 rounded-t-[32px] p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom duration-300 max-h-[88vh] overflow-y-auto text-white">
      {/* Sleek Top Drag Handle */}
      <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5" />

      {/* Header: Verified Status & Thumbnail */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white">إشعار بنكي موثق</h3>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-mono">
                {data.confidence}% ثقة
              </Badge>
            </div>
            <p className="text-xs text-slate-400">راجع البيانات أدناه وأكدها للإضافة اللحظية</p>
          </div>
        </div>

        {/* Thumbnail Preview with Glass Frame */}
        {previewUrl && (
          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/20 shrink-0 shadow-lg relative group">
            <img src={previewUrl} alt="Receipt thumbnail" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Hero Monetary Display Card */}
      <div className="relative bg-gradient-to-br from-emerald-950/50 via-slate-900/60 to-slate-900/90 border border-emerald-500/30 rounded-3xl p-5 mb-5 shadow-inner">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-emerald-400/90 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            المبلغ المستخرج من الإشعار
          </span>

          <button
            onClick={() => setIsEditingAmount(!isEditingAmount)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
          >
            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEditingAmount ? 'حفظ' : 'تعديل المبلغ'}</span>
          </button>
        </div>

        {isEditingAmount ? (
          <div className="mt-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-3xl font-black bg-black/60 text-emerald-300 border-emerald-500/50 text-center rounded-2xl h-14"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex items-baseline justify-between mt-1">
            <div className="text-4xl font-black text-emerald-400 tracking-tight font-mono">
              {numericAmount > 0 ? numericAmount.toLocaleString('en-US') : '0.00'}
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
              ج.س / عملة الحساب
            </div>
          </div>
        )}
      </div>

      {/* Bank & Reference Meta Strip */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Bank Name */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
          <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            البنك المستلم
          </span>
          <span className="font-bold text-slate-100 text-xs truncate block">
            {data.bank_name || data.receiver_account || 'بنك الخرطوم (بنكك)'}
          </span>
        </div>

        {/* Transaction Reference Number */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-emerald-400" />
              رقم العملية / المرجع
            </span>
            {transactionId && (
              <button
                onClick={handleCopyRef}
                className="text-slate-400 hover:text-white"
                title="نسخ الرقم"
              >
                {copiedRef ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
          <span className="font-mono font-bold text-slate-100 text-xs truncate block tracking-wider">
            {transactionId || 'غير متوفر'}
          </span>
        </div>

        {/* Sender Name */}
        <div className="col-span-2 bg-white/5 border border-white/10 rounded-2xl p-3.5">
          <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            اسم العميل المحوّل
          </span>
          <span className="font-bold text-slate-100 text-xs truncate block">
            {senderName || 'غير مدون بالإشعار'}
          </span>
        </div>
      </div>

      {/* Quick Cashier Tags & Custom Memo */}
      <div className="mb-6">
        <label className="text-xs text-slate-300 font-medium mb-2 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-emerald-400" />
          <span>ملاحظة الكاشير (اختياري):</span>
        </label>

        {/* Interactive Quick Tag Pills */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setMemo(memo ? `${memo} - ${tag}` : tag)}
              className="text-[11px] px-3 py-1 rounded-full bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>

        <Input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="أدخل رقم الطلب أو اسم الزبون..."
          className="bg-black/40 border-white/10 text-white placeholder:text-slate-500 text-xs h-11 rounded-2xl focus:border-emerald-500"
        />
      </div>

      {/* Luxury Action CTAs */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleConfirm}
          disabled={!isValid || isSaving}
          className="flex-1 h-14 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-sm rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 active:scale-98 transition-all"
        >
          {isSaving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 fill-current" />
          )}
          <span>{isSaving ? 'جاري التأكيد والإضافة...' : 'تأكيد وإتمام المعاملة فوراً'}</span>
          {!isSaving && <ArrowRight className="w-4 h-4" />}
        </Button>

        <Button
          variant="ghost"
          onClick={onRetake}
          disabled={isSaving}
          className="h-14 px-5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-2xl text-xs flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة</span>
        </Button>
      </div>
    </div>
  );
};
