import React, { forwardRef } from 'react';
import { Sparkles, FileText, CheckCircle2 } from 'lucide-react';

interface CameraViewportProps {
  isStreaming: boolean;
  isCapturing: boolean;
  lightingStatus?: 'good' | 'low';
}

export const CameraViewport = forwardRef<HTMLVideoElement, CameraViewportProps>(
  ({ isStreaming, isCapturing, lightingStatus = 'good' }, ref) => {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-[#05070B] overflow-hidden select-none">
        {/* Ambient Darkened Radial Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-[#05070B]/80 to-[#05070B] pointer-events-none z-10" />

        {/* Live Camera Stream */}
        <video
          ref={ref}
          playsInline
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Shutter Flash Animation */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-200 pointer-events-none" />
        )}

        {/* Frosted Viewfinder Mask Overlay */}
        <div className="relative z-20 w-[84%] max-w-[360px] aspect-[3/4.2] max-h-[66vh] flex flex-col items-center justify-between pointer-events-none">
          {/* Top Frame Brackets */}
          <div className="w-full flex justify-between items-start">
            <div className="relative w-10 h-10">
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_10px_#10b981]" />
            </div>

            <div className="relative w-10 h-10">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_10px_#10b981]" />
            </div>
          </div>

          {/* Central Receipt Guide Silhouette & Laser */}
          <div className="relative w-full flex-1 flex flex-col items-center justify-center overflow-hidden">
            {/* Ghost Receipt Outline */}
            <div className="w-48 h-64 border border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-2 text-white/30 backdrop-blur-[1px]">
              <FileText className="w-8 h-8 stroke-[1.2]" />
              <span className="text-[11px] font-medium tracking-wide">ضع الإشعار داخل الإطار</span>
            </div>

            {/* Glowing Laser Scanline */}
            {isStreaming && (
              <div className="absolute inset-x-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_16px_#10b981] animate-[bounce_2.8s_ease-in-out_infinite]" />
            )}
          </div>

          {/* Bottom Frame Brackets */}
          <div className="w-full flex justify-between items-end">
            <div className="relative w-10 h-10">
              <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-l from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute bottom-0 right-0 w-1 h-full bg-gradient-to-t from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_10px_#10b981]" />
            </div>

            <div className="relative w-10 h-10">
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute bottom-0 left-0 w-1 h-full bg-gradient-to-t from-emerald-400 to-emerald-400/20 rounded-full shadow-[0_0_12px_#10b981]" />
              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_10px_#10b981]" />
            </div>
          </div>
        </div>

        {/* Floating Viewfinder Status Pill */}
        <div className="absolute bottom-28 z-20 flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 text-xs text-white shadow-2xl pointer-events-none animate-in fade-in duration-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-medium text-slate-200">التعرف التلقائي نشط</span>
          <span className="text-white/20">|</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            جاهز للمسح
          </span>
        </div>
      </div>
    );
  }
);

CameraViewport.displayName = 'CameraViewport';
