import React, { useRef } from 'react';
import { Camera, Zap, ZapOff, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraControlsProps {
  onCapture: () => void;
  isCapturing: boolean;
  isStreaming: boolean;
  onFlipCamera: () => void;
  supportsTorch: boolean;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  onFileSelected: (file: File) => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  onCapture,
  isCapturing,
  isStreaming,
  onFlipCamera,
  supportsTorch,
  isTorchOn,
  onToggleTorch,
  onFileSelected,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="w-full bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-6 py-4 flex items-center justify-around z-20">
      {/* Hidden file input for gallery fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Gallery Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => fileInputRef.current?.click()}
        className="w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-transform active:scale-95"
        title="اختيار صورة من المعرض"
      >
        <ImageIcon className="w-5 h-5" />
      </Button>

      {/* Large Tactile Shutter Button */}
      <button
        onClick={onCapture}
        disabled={!isStreaming || isCapturing}
        className="relative group focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        title="التقاط الإشعار الآن"
      >
        {/* Pulsing outer aura */}
        <div className="absolute -inset-1.5 rounded-full bg-emerald-500/30 group-hover:bg-emerald-500/50 blur-sm transition-all animate-pulse" />

        {/* Outer ring */}
        <div className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent transition-transform active:scale-90 group-hover:scale-105">
          {/* Inner core */}
          <div className="w-full h-full rounded-full bg-emerald-500 group-hover:bg-emerald-400 flex items-center justify-center shadow-lg transition-colors">
            <Camera className="w-7 h-7 text-slate-950" />
          </div>
        </div>
      </button>

      {/* Secondary Controls: Torch or Flip */}
      <div className="flex items-center gap-2">
        {supportsTorch ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTorch}
            className={`w-12 h-12 rounded-full border border-slate-700/60 transition-transform active:scale-95 ${
              isTorchOn
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isTorchOn ? 'إطفاء الفلاش' : 'تشغيل الفلاش'}
          >
            {isTorchOn ? <ZapOff className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onFlipCamera}
            className="w-12 h-12 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-transform active:scale-95"
            title="تبديل الكاميرا (أمامية / خلفية)"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
};
