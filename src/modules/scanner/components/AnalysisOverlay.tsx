import React from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';

interface AnalysisOverlayProps {
  previewUrl?: string | null;
}

export const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ previewUrl }) => {
  return (
    <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-center text-white animate-in fade-in duration-300">
      {/* Central Holographic Image Preview Card */}
      {previewUrl && (
        <div className="relative w-44 h-56 rounded-3xl overflow-hidden border border-emerald-500/60 shadow-[0_0_35px_rgba(16,185,129,0.35)] mb-6 bg-slate-900">
          <img src={previewUrl} alt="Captured receipt" className="w-full h-full object-cover" />

          {/* Holographic Laser Grid Sweep */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent animate-[bounce_2s_ease-in-out_infinite]" />

          {/* Corner target marks */}
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />

          {/* Processing badge */}
          <div className="absolute bottom-2 inset-x-2 py-1 rounded-xl bg-black/75 backdrop-blur-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1">
            <Cpu className="w-3 h-3 animate-spin" />
            <span>AI NEURAL ENGINE</span>
          </div>
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-black text-white mb-1.5 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
        <span>تحليل الإشعار المالي...</span>
      </h3>
      <p className="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
        يتم الآن قراءة الأرقام واسم البنك والمطابقة اللحظية مع الدفاتر المالية
      </p>

      {/* Holographic Telemetry Checklist */}
      <div className="w-full max-w-xs space-y-2 text-right">
        <div className="flex items-center justify-between text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-2xl px-3.5 py-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>التقاط الصورة والتشفير السحابي</span>
          </span>
          <span className="text-[10px] font-mono opacity-60">100%</span>
        </div>

        <div className="flex items-center justify-between text-xs text-white bg-slate-900/80 border border-emerald-500/40 rounded-2xl px-3.5 py-2 shadow-lg">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>استخراج المبلغ ورقم المعاملة (Vision OCR)</span>
          </span>
          <span className="text-[10px] font-mono text-emerald-400 animate-pulse">جاري...</span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl px-3.5 py-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
            <span>فحص النزاهة وكشف التكرار (Anti-Fraud)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-600">انتظار</span>
        </div>
      </div>
    </div>
  );
};
