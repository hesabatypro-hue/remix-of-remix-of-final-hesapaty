import React, { useState } from 'react';
import {
  CheckCircle2,
  RefreshCw,
  Building2,
  Hash,
  User,
  StickyNote,
  DollarSign,
  AlertCircle,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0;

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
    <div className="absolute inset-x-0 bottom-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/80 rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto text-white">
      {/* Top Drag Indicator */}
      <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4" />

      {/* Header Info */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-base font-bold text-white">تم استخراج بيانات الإشعار</h3>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] py-0">
              دقة {data.confidence}%
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            تحقق من البيانات أدناه وأكد الإشعار لإضافته فوراً للنظام
          </p>
        </div>

        {/* Thumbnail Preview */}
        {previewUrl && (
          <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 shrink-0 shadow-md">
            <img src={previewUrl} alt="Receipt preview" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Primary Extracted Amount Box */}
      <div className="bg-gradient-to-br from-emerald-950/40 to-slate-800/60 border border-emerald-500/30 rounded-2xl p-4 mb-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            المبلغ المالي المستخرج:
          </span>
          <button
            onClick={() => setIsEditingAmount(!isEditingAmount)}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <Edit2 className="w-3 h-3" />
            <span>{isEditingAmount ? 'حفظ' : 'تعديل المبلغ'}</span>
          </button>
        </div>

        {isEditingAmount ? (
          <div className="mt-2">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-black bg-slate-900 text-emerald-300 border-emerald-500/50 text-center"
              autoFocus
            />
          </div>
        ) : (
          <div className="flex items-baseline justify-between mt-1">
            <div className="text-3xl font-black text-emerald-400 tracking-tight">
              {numericAmount > 0 ? numericAmount.toLocaleString('en-US') : '0.00'}
            </div>
            <span className="text-sm font-bold text-slate-400">ج.س / عملة الحساب</span>
          </div>
        )}
      </div>

      {/* Secondary Meta Fields Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 text-xs">
        {/* Bank */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5">
          <span className="text-slate-400 text-[10px] block mb-0.5 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            البنك
          </span>
          <span className="font-semibold text-slate-200 truncate block">
            {data.bank_name || data.receiver_account || 'بنك الخرطوم (بنكك)'}
          </span>
        </div>

        {/* Transaction ID */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5">
          <span className="text-slate-400 text-[10px] block mb-0.5 flex items-center gap-1">
            <Hash className="w-3 h-3 text-slate-400" />
            رقم العملية / المرجع
          </span>
          <span className="font-mono font-semibold text-slate-200 truncate block">
            {transactionId || 'غير محدد'}
          </span>
        </div>

        {/* Sender Name (Full span) */}
        <div className="col-span-2 bg-slate-800/60 border border-slate-700/60 rounded-xl p-2.5">
          <span className="text-slate-400 text-[10px] block mb-0.5 flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" />
            اسم المحوّل / العميل
          </span>
          <span className="font-semibold text-slate-200 truncate block">
            {senderName || 'غير متوفر بالإشعار'}
          </span>
        </div>
      </div>

      {/* Cashier Memo Input */}
      <div className="mb-5">
        <Label htmlFor="scanner-memo" className="text-xs text-slate-300 mb-1.5 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5 text-emerald-400" />
          <span>إضافة ملاحظة اختيارية (رقم الطلب / الطاولة / اسم العميل):</span>
        </Label>
        <Input
          id="scanner-memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="مثال: طلب #24 أو طاولة 5..."
          className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 text-xs h-9 rounded-xl focus:border-emerald-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleConfirm}
          disabled={!isValid || isSaving}
          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
        >
          {isSaving ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          <span>{isSaving ? 'جاري التأكيد والإضافة...' : 'تأكيد وإضافة للنظام فوراً'}</span>
        </Button>

        <Button
          variant="outline"
          onClick={onRetake}
          disabled={isSaving}
          className="h-12 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700 rounded-xl text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة التصوير</span>
        </Button>
      </div>
    </div>
  );
};
