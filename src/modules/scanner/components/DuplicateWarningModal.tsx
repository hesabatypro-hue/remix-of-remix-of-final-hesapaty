import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DuplicateCheckResult } from '../types';

interface DuplicateWarningModalProps {
  duplicate: DuplicateCheckResult;
  onCancel: () => void;
  onProceedAnyway: () => void;
}

export const DuplicateWarningModal: React.FC<DuplicateWarningModalProps> = ({
  duplicate,
  onCancel,
  onProceedAnyway,
}) => {
  return (
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-5 text-white animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-6 shadow-2xl text-center">
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4 text-amber-400">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <h3 className="text-lg font-bold text-white mb-2">
          تنبيه أمني: إشعار تحويل مكرر!
        </h3>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          تم اكتشاف أن هذا الإشعار تم إدخاله مسبقاً بنفس رقم المرجع في النظام!
        </p>

        {/* Existing details box */}
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3 text-right text-xs mb-5 space-y-1 text-amber-200">
          {duplicate.existingAmount && (
            <div className="flex justify-between">
              <span className="text-slate-400">المبلغ المسجل سابقاً:</span>
              <span className="font-bold">{duplicate.existingAmount.toLocaleString()} ج.س</span>
            </div>
          )}
          {duplicate.existingCreatedAt && (
            <div className="flex justify-between">
              <span className="text-slate-400">وقت الإدخال السابق:</span>
              <span>{new Date(duplicate.existingCreatedAt).toLocaleTimeString('ar-EG')}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            onClick={onCancel}
            className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg"
          >
            إلغاء العملية ورفض الإشعار (موصى به)
          </Button>

          <Button
            variant="ghost"
            onClick={onProceedAnyway}
            className="w-full h-9 text-slate-400 hover:text-white text-[11px]"
          >
            متابعة واعتماد الإشعار رغم التكرار
          </Button>
        </div>
      </div>
    </div>
  );
};
