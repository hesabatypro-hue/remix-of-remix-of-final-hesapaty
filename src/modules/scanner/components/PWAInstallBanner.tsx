import React, { useState } from 'react';
import { Download, X, Sparkles, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PWAInstallBannerProps {
  canInstall: boolean;
  onInstall: () => void;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  canInstall,
  onInstall,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!canInstall || isDismissed) return null;

  return (
    <div className="absolute top-16 inset-x-4 z-30 bg-black/75 backdrop-blur-2xl border border-emerald-500/40 rounded-2xl p-3.5 shadow-2xl text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_12px_#10b981]">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
            <span>تثبيت حساباتي سكانر كتطبيق مستقل</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </h4>
          <p className="text-[10px] text-slate-300">
            أضفه لسطح المكتب أو الشاشة الرئيسية لفتح الكاميرا بسرعة بدون شريط المتصفح
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          onClick={onInstall}
          className="h-8 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تثبيت</span>
        </Button>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          title="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
