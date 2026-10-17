import { useState, useEffect, useRef, useCallback } from 'react';
import type { CameraDevice } from '../types';

interface UseCameraStreamOptions {
  initialFacingMode?: 'environment' | 'user';
}

export function useCameraStream(options: UseCameraStreamOptions = {}) {
  const { initialFacingMode = 'environment' } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(initialFacingMode);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [supportsTorch, setSupportsTorch] = useState(false);

  // Stop current tracks
  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setIsTorchOn(false);
    setSupportsTorch(false);
  }, []);

  // Enumerate available video input devices
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `كاميرا ${index + 1}`,
        }));
      setDevices(videoDevices);
    } catch (e) {
      console.warn('[useCameraStream] Could not enumerate devices:', e);
    }
  }, []);

  // Start media stream
  const startStream = useCallback(async () => {
    stopTracks();
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('المتصفح أو الجهاز الحالي لا يدعم الوصول للكاميرا');
      setHasPermission(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : {
              facingMode: { ideal: facingMode },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((playErr) => {
          console.warn('[useCameraStream] Video play error:', playErr);
        });
      }

      setHasPermission(true);
      setIsStreaming(true);

      // Check if current track supports torch
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities?.() as { torch?: boolean }) || {};
        setSupportsTorch(Boolean(capabilities.torch));
      }

      await enumerateDevices();
    } catch (err: any) {
      console.error('[useCameraStream] getUserMedia failed:', err);
      setIsStreaming(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setHasPermission(false);
        setError('تم رفض إذن الوصول للكاميرا. يرجى تفعيل الإذن من إعدادات المتصفح.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setHasPermission(false);
        setError('لم يتم العثور على كاميرا متصلة بالجهاز.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('الكاميرا قيد الاستخدام من قبل تطبيق آخر حالياً.');
      } else {
        setError(err.message || 'تعذر تشغيل الكاميرا.');
      }
    }
  }, [facingMode, selectedDeviceId, stopTracks, enumerateDevices]);

  // Toggle flash/torch if supported
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !supportsTorch) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const nextState = !isTorchOn;
      await (videoTrack.applyConstraints as any)({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('[useCameraStream] Failed to toggle torch:', e);
    }
  }, [isTorchOn, supportsTorch]);

  // Flip camera between front and back
  const flipCamera = useCallback(() => {
    setSelectedDeviceId(null);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  // Lifecycle: start on mount, clean up on unmount
  useEffect(() => {
    startStream();
    return () => {
      stopTracks();
    };
  }, [startStream, stopTracks]);

  return {
    videoRef,
    isStreaming,
    hasPermission,
    error,
    facingMode,
    flipCamera,
    isTorchOn,
    supportsTorch,
    toggleTorch,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    restartStream: startStream,
  };
}
