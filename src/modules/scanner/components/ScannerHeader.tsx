import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Store,
  X,
  Zap,
  ZapOff,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ScannerHeaderProps {
  organizationName?: string;
  branches: Array<{ id: string; name: string }>;
  selectedBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
  isStandalone: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  supportsTorch: boolean;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  cashierName?: string;
}

export const ScannerHeader: React.FC<ScannerHeaderProps> = ({
  organizationName,
  branches,
  selectedBranchId,
  onSelectBranch,
  isStandalone,
  soundEnabled,
  onToggleSound,
  supportsTorch,
  isTorchOn,
  onToggleTorch,
  cashierName,
}) => {
  const navigate = useNavigate();
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  const currentBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];

  return (
    <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between pointer-events-none">
      {/* Left: Floating Branch Pill */}
      <div className="relative pointer-events-auto">
        <button
          onClick={() => branches.length > 1 && setShowBranchMenu(!showBranchMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white text-xs shadow-2xl hover:bg-black/80 transition-all active:scale-95"
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
          <Store className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-100 max-w-[110px] truncate">
            {currentBranch?.name || 'الفرع الرئيسي'}
          </span>
          {branches.length > 1 && (
            <ChevronDown className="w-3 h-3 text-slate-400" />
          )}
        </button>

        {/* Branch Switcher Dropdown */}
        {showBranchMenu && (
          <div className="absolute top-10 right-0 w-48 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-2.5 py-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              تبديل الفرع
            </div>
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  onSelectBranch(b.id);
                  setShowBranchMenu(false);
                }}
                className={`w-full text-right px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                  b.id === selectedBranchId
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{b.name}</span>
                {b.id === selectedBranchId && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center: Brand Pill */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-[11px] font-bold text-white shadow-xl pointer-events-auto">
        <span className="text-emerald-400 font-black">HESAPATY</span>
        <span className="text-slate-500">•</span>
        <span className="text-slate-300 font-medium">SCAN</span>
      </div>

      {/* Right: Quick Action Controls */}
      <div className="flex items-center gap-1.5 pointer-events-auto">
        {/* Torch Button */}
        {supportsTorch && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTorch}
            className={`w-9 h-9 rounded-full backdrop-blur-xl border transition-all active:scale-90 ${
              isTorchOn
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.6)]'
                : 'bg-black/60 text-white/80 border-white/10 hover:bg-black/80 hover:text-white'
            }`}
            title={isTorchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
          >
            {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
          </Button>
        )}

        {/* Audio Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSound}
          className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-all active:scale-90"
          title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </Button>

        {/* Close Button (if in browser mode) */}
        {!isStandalone && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-white/80 hover:text-white hover:bg-black/80 transition-all active:scale-90"
            title="إغلاق والعودة للوحة التحكم"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
