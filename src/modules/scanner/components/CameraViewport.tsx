import React, { forwardRef } from 'react';
import { Scan, Sparkles } from 'lucide-react';

interface CameraViewportProps {
  isStreaming: boolean;
  isCapturing: boolean;
}

export const CameraViewport = forwardRef<HTMLVideoElement, CameraViewportProps>(
  ({ isStreaming, isCapturing }, ref) => {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
        {/* HTML5 Video element */}
        <video
          ref={ref}
          playsInline
          autoPlay
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Shutter flash animation overlay */}
        {isCapturing && (
          <div className="absolute inset-0 bg-white/90 z-30 animate-out fade-out duration-300 pointer-events-none" />
        )}

        {/* Viewfinder frame overlay */}
        <div className="relative z-10 w-[85%] max-w-[340px] aspect-[3/4] max-h-[70vh] flex flex-col items-center justify-between pointer-events-none">
          {/* Top brackets */}
          <div className="w-full flex justify-between">
            <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg shadow-lg" />
            <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg shadow-lg" />
          </div>

          {/* Laser scanning line animation */}
          {isStreaming && (
            <div className="w-full relative overflow-hidden flex-1 flex items-center">
              <div
                className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-bounce"
                style={{
                  animationDuration: '2.5s',
                  animationTimingFunction: 'ease-in-out',
                }}
              />
            </div>
          )}

          {/* Bottom brackets */}
          <div className="w-full flex justify-between">
            <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg shadow-lg" />
            <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg shadow-lg" />
          </div>

          {/* Guidance badge */}
          <div className="absolute -bottom-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-[11px] text-slate-300 shadow-md">
            <Scan className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>وجّه الكاميرا نحو إشعار التحويل البنكي</span>
          </div>
        </div>

        {/* Darkened vignette around viewfinder */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />
      </div>
    );
  }
);

CameraViewport.displayName = 'CameraViewport';
