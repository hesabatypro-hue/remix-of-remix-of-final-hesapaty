import React, { useRef } from 'react';
import { CameraOff, RefreshCw, Upload, ShieldAlert, CheckCircle2 } from 'lucide-react';
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
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Blocked Camera Icon */}
      <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-5 shadow-xl">
        <CameraOff className="w-10 h-10" />
      </div>

      <h2 className="text-xl font-bold text-white mb-2">
        يرجى السماح بالوصول إلى الكاميرا
      </h2>

      <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
        {errorMessage ||
          'يحتاج تطبيق حساباتي سكانر إلى إذن الكاميرا لمسح إشعارات التحويلات البنكية وإتمام المعاملات فورياً.'}
      </p>

      {/* Step by step guide */}
      <div className="w-full max-w-sm bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-right text-xs space-y-2.5 mb-6 text-slate-300">
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
            1
          </span>
          <span>انقر على أيقونة القفل أو الكاميرا بجانب شريط العنوان في المتصفح.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
            2
          </span>
          <span>اختر "السماح" (Allow) للكاميرا في إعدادات الموقع.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
            3
          </span>
          <span>اضغط على زر "إعادة المحاولة" أدناه.</span>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-2.5">
        <Button
          onClick={onRetry}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>إعادة المحاولة وطلب الإذن</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 rounded-xl text-xs flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          <span>أو اختيار صورة إشعار من المعرض</span>
        </Button>
      </div>
    </div>
  );
};
