import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches } from '@/hooks/useBranches';
import { useToast } from '@/hooks/use-toast';
import { useCameraStream } from './hooks/useCameraStream';
import { usePWAInstallPrompt } from './hooks/usePWAInstallPrompt';
import { useReceiptAnalyzer } from './hooks/useReceiptAnalyzer';
import { captureAndCompressFromVideo, compressImageFile } from './utils/imageCompressor';
import { audioFeedback } from './utils/audioFeedback';
import { injectScannerManifest } from './utils/manifestInjector';
import { ScannerHeader } from './components/ScannerHeader';
import { CameraViewport } from './components/CameraViewport';
import { CameraControls } from './components/CameraControls';
import { AnalysisOverlay } from './components/AnalysisOverlay';
import { VerificationCard } from './components/VerificationCard';
import { DuplicateWarningModal } from './components/DuplicateWarningModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { PermissionDeniedView } from './components/PermissionDeniedView';
import type { CapturedImagePayload, ScannerPhase } from './types';

export const ScannerDashboard: React.FC = () => {
  const { currentOrganization, user, userProfile } = useAuth();
  const { branches } = useBranches();
  const { toast } = useToast();

  // Branch Selection: default to first active branch or localStorage
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(() => {
    return localStorage.getItem('hesapaty_scanner_selected_branch') || null;
  });

  useEffect(() => {
    if (!selectedBranchId && branches.length > 0) {
      const defaultId = branches[0].id;
      setSelectedBranchId(defaultId);
      localStorage.setItem('hesapaty_scanner_selected_branch', defaultId);
    }
  }, [branches, selectedBranchId]);

  const handleSelectBranch = (branchId: string) => {
    setSelectedBranchId(branchId);
    localStorage.setItem('hesapaty_scanner_selected_branch', branchId);
  };

  // Sound & Haptics settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Dynamic PWA scoped manifest injection
  useEffect(() => {
    const cleanup = injectScannerManifest();
    return cleanup;
  }, []);

  // Camera stream hook
  const {
    videoRef,
    isStreaming,
    hasPermission,
    error: cameraError,
    flipCamera,
    isTorchOn,
    supportsTorch,
    toggleTorch,
    restartStream,
  } = useCameraStream({ initialFacingMode: 'environment' });

  // PWA Install prompt hook
  const { canInstall, isStandalone, promptInstall } = usePWAInstallPrompt();

  // Receipt Analyzer hook
  const {
    isAnalyzing,
    isSaving,
    extractedData,
    duplicateResult,
    analyzeImage,
    confirmTransfer,
    reset: resetAnalyzer,
  } = useReceiptAnalyzer({
    organizationId: currentOrganization?.id || null,
    branchId: selectedBranchId,
    userId: user?.id || null,
  });

  // Local UI phase state
  const [phase, setPhase] = useState<ScannerPhase>('streaming');
  const [capturedPayload, setCapturedPayload] = useState<CapturedImagePayload | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Take photo from video stream
  const handleCapture = async () => {
    if (!videoRef.current || phase !== 'streaming') return;

    try {
      setPhase('capturing');
      if (soundEnabled) {
        audioFeedback.playShutter();
        audioFeedback.vibrate(30);
      }

      // Capture and compress WebP in under 150ms
      const payload = await captureAndCompressFromVideo(videoRef.current, {
        maxDimension: 1600,
        quality: 0.85,
        mimeType: 'image/webp',
      });

      setCapturedPayload(payload);
      setPhase('analyzing');

      // Send to OCR & anti-fraud
      const result = await analyzeImage(payload);

      if (result.duplicate.isDuplicate) {
        if (soundEnabled) audioFeedback.playAlert();
        setShowDuplicateModal(true);
      } else {
        if (soundEnabled) audioFeedback.vibrate([20, 50, 20]);
      }

      setPhase('verifying');
    } catch (err: any) {
      console.error('[ScannerDashboard] Capture/Analyze error:', err);
      if (soundEnabled) audioFeedback.playAlert();
      toast({
        title: 'تعذر تحليل الإشعار',
        description: err.message || 'يرجى التأكد من وضوح الصورة وإعادة المحاولة.',
        variant: 'destructive',
      });
      setPhase('streaming');
    }
  };

  // Upload image from file picker
  const handleFileSelected = async (file: File) => {
    try {
      setPhase('capturing');
      if (soundEnabled) {
        audioFeedback.playShutter();
      }

      const payload = await compressImageFile(file, {
        maxDimension: 1600,
        quality: 0.85,
        mimeType: 'image/webp',
      });

      setCapturedPayload(payload);
      setPhase('analyzing');

      const result = await analyzeImage(payload);

      if (result.duplicate.isDuplicate) {
        if (soundEnabled) audioFeedback.playAlert();
        setShowDuplicateModal(true);
      }

      setPhase('verifying');
    } catch (err: any) {
      console.error('[ScannerDashboard] File analyze error:', err);
      if (soundEnabled) audioFeedback.playAlert();
      toast({
        title: 'خطأ في معالجة الملف',
        description: err.message || 'تعذر قراءة الصورة المحددة.',
        variant: 'destructive',
      });
      setPhase('streaming');
    }
  };

  // Confirm and persist to database
  const handleConfirmTransfer = async (payload: {
    amount: number;
    transactionId?: string | null;
    senderName?: string | null;
    memo?: string | null;
  }) => {
    try {
      await confirmTransfer(payload);

      if (soundEnabled) {
        audioFeedback.playSuccess();
        audioFeedback.vibrate([40, 60, 80]);
      }

      toast({
        title: 'تم تأكيد العملية بنجاح! ✅',
        description: `تم تسجيل مبلغ ${payload.amount.toLocaleString()} ج.س في النظام فوراً.`,
      });

      // Reset and resume camera for next customer
      handleResetToCamera();
    } catch (err: any) {
      console.error('[ScannerDashboard] Confirmation error:', err);
      if (soundEnabled) audioFeedback.playAlert();
      toast({
        title: 'فشل تأكيد العملية',
        description: err.message || 'حدث خطأ أثناء حفظ العملية في قاعدة البيانات.',
        variant: 'destructive',
      });
    }
  };

  // Reset back to live camera stream
  const handleResetToCamera = useCallback(() => {
    resetAnalyzer();
    setCapturedPayload(null);
    setShowDuplicateModal(false);
    setPhase('streaming');
  }, [resetAnalyzer]);

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-black overflow-hidden select-none">
      {/* Top Floating Glass HUD */}
      <ScannerHeader
        organizationName={currentOrganization?.name}
        branches={branches}
        selectedBranchId={selectedBranchId}
        onSelectBranch={handleSelectBranch}
        isStandalone={isStandalone}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        supportsTorch={supportsTorch}
        isTorchOn={isTorchOn}
        onToggleTorch={toggleTorch}
        cashierName={userProfile?.full_name || user?.email}
      />

      {/* PWA Smart Install Banner */}
      <PWAInstallBanner canInstall={canInstall} onInstall={promptInstall} />

      {/* Main View Area */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {hasPermission === false ? (
          <PermissionDeniedView
            onRetry={restartStream}
            onFileSelected={handleFileSelected}
            errorMessage={cameraError}
          />
        ) : (
          <>
            <CameraViewport
              ref={videoRef}
              isStreaming={isStreaming}
              isCapturing={phase === 'capturing'}
            />

            {/* AI Analysis Overlay */}
            {isAnalyzing && (
              <AnalysisOverlay previewUrl={capturedPayload?.dataUrl} />
            )}

            {/* Anti-Fraud Duplicate Warning Modal */}
            {showDuplicateModal && duplicateResult?.isDuplicate && (
              <DuplicateWarningModal
                duplicate={duplicateResult}
                onCancel={handleResetToCamera}
                onProceedAnyway={() => setShowDuplicateModal(false)}
              />
            )}

            {/* Verification & Confirmation Card */}
            {phase === 'verifying' && extractedData && !showDuplicateModal && (
              <VerificationCard
                data={extractedData}
                previewUrl={capturedPayload?.dataUrl}
                isSaving={isSaving}
                onConfirm={handleConfirmTransfer}
                onRetake={handleResetToCamera}
              />
            )}
          </>
        )}
      </div>

      {/* Floating Bottom Shutter Deck (visible when streaming) */}
      {hasPermission !== false && phase === 'streaming' && (
        <CameraControls
          onCapture={handleCapture}
          isCapturing={phase === 'capturing'}
          isStreaming={isStreaming}
          onFlipCamera={flipCamera}
          onFileSelected={handleFileSelected}
        />
      )}
    </div>
  );
};
