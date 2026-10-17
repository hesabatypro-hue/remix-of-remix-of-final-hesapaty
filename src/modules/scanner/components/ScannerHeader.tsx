import React from 'react';
import { Camera, Volume2, VolumeX, Store, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface ScannerHeaderProps {
  organizationName?: string;
  branches: Array<{ id: string; name: string }>;
  selectedBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
  isStandalone: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
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
  cashierName,
}) => {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-white z-20">
      {/* Brand & Mode */}
      <div className="flex items-center gap-2.5">
        {!isStandalone && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="text-slate-400 hover:text-white hover:bg-slate-800 -mr-1"
            title="العودة للوحة التحكم"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold tracking-tight text-white">حساباتي سكانر</h1>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-emerald-950/60 border-emerald-500/40 text-emerald-300">
                AI Vision
              </Badge>
            </div>
            {organizationName && (
              <p className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                {organizationName}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Branch Selector & Controls */}
      <div className="flex items-center gap-2">
        {branches.length > 1 ? (
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg px-2 py-1 text-xs">
            <Store className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranchId || ''}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="bg-transparent text-white text-xs outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-white">
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : branches[0] ? (
          <div className="flex items-center gap-1 bg-slate-800/70 border border-slate-700/50 rounded-lg px-2 py-1 text-[11px] text-slate-300">
            <Store className="w-3 h-3 text-emerald-400" />
            <span>{branches[0].name}</span>
          </div>
        ) : null}

        {/* Sound toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSound}
          className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8"
          title={soundEnabled ? 'كتم الصوت' : 'تفعيل المؤثرات الصوتية'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </Button>
      </div>
    </header>
  );
};
