import React, { useRef } from 'react';
import { CameraOff, RefreshCw, Upload, Sparkles, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionDeniedViewProps {
  onRetry: () => void;
  onFileSelected: (file: File) => void;
  errorMessage?: string | null;
}

export const PermissionDeniedView: React.FC<PermissionDeniedViewProps> = ({
  onRetry,
  onFileSelected,
  errorMessage,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#05070B] text-white text-center relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 w-72 h-72 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hero Icon */}
      <div className="relative w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
        <CameraOff className="w-10 h-10" />
      </div>

      <h2 className="text-xl font-black text-white mb-2">
        يرجى تفعيل إذن الكاميرا للمتابعة
      </h2>

      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
        {errorMessage ||
          'يعتمد حساباتي سكانر على الكاميرا للتعرف الفوري على مبالغ إشعارات التحويلات ومطابقتها آلياً.'}
      </p>

      {/* Visual Instruction Steps */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-4 text-right text-xs space-y-3 mb-6 text-slate-300 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
            1
          </span>
          <span>انقر على أيقونة القفل أو الأذونات في شريط العنوان بالمتصفح.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
            2
          </span>
          <span>غيّر خيار الكاميرا إلى "السماح" (Allow).</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
            3
          </span>
          <span>اضغط على الزر الأخضر أدناه لإعادة تشغيل الكاميرا.</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onRetry}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة المحاولة وطلب الإذن</span>
        </Button>

        <Button
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-12 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-2xl text-xs flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          <span>أو اختيار صورة إشعار من المعرض</span>
        </Button>
      </div>
    </div>
  );
};
