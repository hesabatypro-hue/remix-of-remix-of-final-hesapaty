import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, X } from 'lucide-react';
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
    <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-6 text-white animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-sm bg-[#0E131F] border border-amber-500/40 rounded-3xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 inset-x-0 h-24 bg-amber-500/10 blur-2xl" />

        {/* Warning Icon Aura */}
        <div className="relative w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <h3 className="text-lg font-black text-white mb-2">
          تنبيه أمني: إشعار تحويل مكرر!
        </h3>

        <p className="text-xs text-slate-300 leading-relaxed mb-5">
          تم استخدام هذا الإشعار من قبل في النظام بنفس رقم المرجع. يرجى التأكد لتفادي الاحتيال أو تكرار القيد المالي.
        </p>

        {/* Existing Details Box */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-right text-xs mb-6 space-y-2 text-amber-200">
          {duplicate.existingAmount && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">المبلغ المسجل سابقاً:</span>
              <span className="font-mono font-bold text-sm text-white">
                {duplicate.existingAmount.toLocaleString()} ج.س
              </span>
            </div>
          )}
          {duplicate.existingCreatedAt && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">توقيت الإدخال السابق:</span>
              <span className="font-mono text-slate-300">
                {new Date(duplicate.existingCreatedAt).toLocaleTimeString('ar-EG')}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <Button
            onClick={onCancel}
            className="w-full h-12 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span>إلغاء العملية ورفض الإشعار (موصى به)</span>
          </Button>

          <Button
            variant="ghost"
            onClick={onProceedAnyway}
            className="w-full h-10 text-slate-400 hover:text-white text-[11px] rounded-xl hover:bg-white/5"
          >
            متابعة واعتماد الإشعار رغم التكرار
          </Button>
        </div>
      </div>
    </div>
  );
};
