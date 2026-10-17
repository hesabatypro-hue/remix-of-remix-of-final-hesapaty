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
    <div className="absolute top-16 inset-x-3 z-30 bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 rounded-2xl p-3 shadow-xl text-white flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-1">
            <span>تثبيت حساباتي سكانر كتطبيق مستقل</span>
            <Sparkles className="w-3 h-3 text-emerald-400" />
          </h4>
          <p className="text-[10px] text-emerald-200/80">
            أضفه لسطح المكتب أو الشاشة الرئيسية لفتح الكاميرا بسرعة بدون شريط المتصفح
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          onClick={onInstall}
          className="h-8 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تثبيت الآن</span>
        </Button>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-emerald-300/60 hover:text-white p-1 rounded-lg"
          title="إغلاق التنبيه"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
