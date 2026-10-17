import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraControlsProps {
  onCapture: () => void;
  isCapturing: boolean;
  isStreaming: boolean;
  onFlipCamera: () => void;
  onFileSelected: (file: File) => void;
}

export const CameraControls: React.FC<CameraControlsProps> = ({
  onCapture,
  isCapturing,
  isStreaming,
  onFlipCamera,
  onFileSelected,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  return (
    <div className="absolute bottom-6 inset-x-0 z-30 flex flex-col items-center pointer-events-none">
      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Floating Glass Controller Deck */}
      <div className="flex items-center justify-between gap-8 px-6 py-2 rounded-full bg-black/50 backdrop-blur-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] pointer-events-auto">
        {/* Gallery Pick Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90"
          title="اختيار صورة من الاستوديو"
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        {/* Master FinTech Shutter Button */}
        <button
          onClick={onCapture}
          disabled={!isStreaming || isCapturing}
          className="relative group focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed select-none active:scale-95 transition-transform"
          title="التقاط الإشعار الآن"
        >
          {/* Subtle Outer Neon Pulse */}
          <div className="absolute -inset-2 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/40 blur-md transition-all animate-pulse" />

          {/* Double Concentric Metallic Rings */}
          <div className="relative w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center p-1.5 transition-transform">
            <div className="w-full h-full rounded-full border border-white/60 flex items-center justify-center p-1 bg-white/5 backdrop-blur-sm">
              {/* Inner Emerald Shutter Core */}
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-400 group-hover:from-emerald-400 group-hover:to-teal-300 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all">
                <Camera className="w-7 h-7 text-slate-950 fill-current" />
              </div>
            </div>
          </div>
        </button>

        {/* Flip Camera Button */}
        <button
          onClick={onFlipCamera}
          className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-90"
          title="تبديل الكاميرا (أمامية / خلفية)"
        >
          <RefreshCw className="w-5 h-5 hover:rotate-180 transition-transform duration-300" />
        </button>
      </div>

      <span className="text-[10px] text-white/40 mt-2 font-medium tracking-wide">
        انقر للتصوير أو اسحب من المعرض
      </span>
    </div>
  );
};
