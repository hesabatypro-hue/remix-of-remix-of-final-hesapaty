import React from 'react';
import { Sparkles, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

interface AnalysisOverlayProps {
  previewUrl?: string | null;
}

export const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ previewUrl }) => {
  return (
    <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white animate-in fade-in duration-200">
      {/* Thumbnail preview if available */}
      {previewUrl && (
        <div className="w-24 h-32 rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] mb-6 relative">
          <img src={previewUrl} alt="Captured receipt" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
        </div>
      )}

      {/* Radar scanning loader */}
      <div className="relative w-16 h-16 flex items-center justify-center mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/60 flex items-center justify-center text-emerald-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-emerald-400" />
        <span>جاري تحليل الإشعار بالذكاء الاصطناعي...</span>
      </h3>
      <p className="text-xs text-slate-400 max-w-xs mb-6">
        يتم الآن قراءة المبلغ واسم البنك ورقم المعاملة ومطابقة الحسابات المالية
      </p>

      {/* Live analysis steps */}
      <div className="w-full max-w-xs space-y-2 text-right">
        <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-800/40 rounded-lg px-3 py-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>تم رفع الصورة للتخزين السحابي المحمي</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-1.5">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <span>استخراج المبلغ ورقم المرجع (OCR Vision)</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/40 border border-slate-800/60 rounded-lg px-3 py-1.5">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
          <span>التحقق من عدم تكرار الإشعار (Anti-Fraud)</span>
        </div>
      </div>
    </div>
  );
};
