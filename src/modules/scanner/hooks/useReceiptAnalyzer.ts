import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  CapturedImagePayload,
  ExtractedReceiptData,
  DuplicateCheckResult,
} from '../types';

interface UseReceiptAnalyzerProps {
  organizationId: string | null;
  branchId: string | null;
  userId: string | null;
}

export function useReceiptAnalyzer({
  organizationId,
  branchId,
  userId,
}: UseReceiptAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedReceiptData | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string | null>(null);

  // Reset analysis state
  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setIsSaving(false);
    setAnalysisError(null);
    setExtractedData(null);
    setDuplicateResult(null);
    setUploadedStoragePath(null);
  }, []);

  // Upload to Supabase Storage with organization-scoped path
  const uploadImageToStorage = async (
    payload: CapturedImagePayload
  ): Promise<string> => {
    if (!organizationId) {
      throw new Error('لم يتم تحديد المؤسسة. يرجى التأكد من تسجيل الدخول.');
    }

    const effectiveBranch = branchId || 'general';
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}_${randomSuffix}.webp`;
    const filePath = `${organizationId}/${effectiveBranch}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, payload.blob, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[useReceiptAnalyzer] Storage upload failed:', uploadError);
      throw new Error(`فشل رفع الصورة للتخزين السحابي: ${uploadError.message}`);
    }

    return `storage:receipts/${filePath}`;
  };

  // Check for duplicate transaction in transfers table (Anti-Fraud)
  const checkDuplicateTransaction = async (
    transactionId: string | null
  ): Promise<DuplicateCheckResult> => {
    if (!transactionId || !organizationId) {
      return { isDuplicate: false };
    }

    const cleanRef = transactionId.trim();
    if (cleanRef.length < 3) {
      return { isDuplicate: false };
    }

    try {
      const { data: existing, error } = await supabase
        .from('transfers')
        .select('id, amount, created_at')
        .eq('organization_id', organizationId)
        .eq('transaction_id', cleanRef)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[useReceiptAnalyzer] Duplicate check query error:', error);
        return { isDuplicate: false };
      }

      if (existing) {
        return {
          isDuplicate: true,
          existingTransferId: existing.id,
          existingCreatedAt: existing.created_at,
          existingAmount: existing.amount,
        };
      }

      return { isDuplicate: false };
    } catch (e) {
      console.warn('[useReceiptAnalyzer] Duplicate check exception:', e);
      return { isDuplicate: false };
    }
  };

  // Analyze captured image via AI OCR Edge Function
  const analyzeImage = useCallback(
    async (payload: CapturedImagePayload) => {
      reset();
      setIsAnalyzing(true);
      setAnalysisError(null);

      try {
        // 1. Upload to storage in parallel with starting OCR
        const storagePathPromise = uploadImageToStorage(payload);

        // 2. Call extract-transfer-amount Edge Function with base64 dataUrl
        const edgeFunctionPromise = supabase.functions.invoke('extract-transfer-amount', {
          body: {
            imageBase64: payload.dataUrl,
            organization_id: organizationId,
          },
        });

        const [storagePath, { data: ocrResponse, error: functionError }] =
          await Promise.all([storagePathPromise, edgeFunctionPromise]);

        setUploadedStoragePath(storagePath);

        if (functionError) {
          console.error('[useReceiptAnalyzer] OCR function error:', functionError);
          throw new Error('تعذر معالجة الإشعار بالذكاء الاصطناعي. يرجى إدخال البيانات يدوياً.');
        }

        const extracted = (ocrResponse?.data || ocrResponse) as ExtractedReceiptData;

        // Auto-detect bank name if recognizable
        let detectedBank: string | null = null;
        if (extracted?.bank_comment?.includes('بنكك') || extracted?.receiver_account?.includes('بنكك')) {
          detectedBank = 'بنك الخرطوم (بنكك)';
        } else if (extracted?.bank_comment?.includes('فوري') || extracted?.receiver_account?.includes('فوري')) {
          detectedBank = 'بنك فيصل الإسلامي (فوري)';
        } else if (extracted?.bank_comment?.includes('أوكاش') || extracted?.receiver_account?.includes('أوكاش')) {
          detectedBank = 'بنك أم درمان الوطني (أوكاش)';
        }

        const finalExtracted: ExtractedReceiptData = {
          amount: typeof extracted?.amount === 'number' ? extracted.amount : null,
          date: extracted?.date || new Date().toISOString().split('T')[0],
          sender_name: extracted?.sender_name || null,
          transaction_id: extracted?.transaction_id || extracted?.reference_number || null,
          receiver_account: extracted?.receiver_account || null,
          sender_account: extracted?.sender_account || null,
          bank_comment: extracted?.bank_comment || null,
          reference_number: extracted?.reference_number || extracted?.transaction_id || null,
          confidence: typeof extracted?.confidence === 'number' ? extracted.confidence : 85,
          bank_name: detectedBank,
        };

        setExtractedData(finalExtracted);

        // 3. Perform duplicate check
        const dupCheck = await checkDuplicateTransaction(finalExtracted.transaction_id);
        setDuplicateResult(dupCheck);

        return {
          extracted: finalExtracted,
          storagePath,
          duplicate: dupCheck,
        };
      } catch (err: any) {
        console.error('[useReceiptAnalyzer] Analysis failed:', err);
        const msg = err.message || 'حدث خطأ أثناء فحص الإشعار.';
        setAnalysisError(msg);
        throw err;
      } finally {
        setIsAnalyzing(false);
      }
    },
    [organizationId, branchId, reset]
  );

  // Confirm transfer and save to transfers table
  const confirmTransfer = useCallback(
    async (options: {
      amount: number;
      transactionId?: string | null;
      senderName?: string | null;
      memo?: string | null;
      notes?: string | null;
    }) => {
      if (!organizationId) {
        throw new Error('المؤسسة غير محددة');
      }
      if (!branchId) {
        throw new Error('يرجى تحديد الفرع أولاً');
      }
      if (!options.amount || options.amount <= 0) {
        throw new Error('مبلغ العملية غير صالح');
      }

      setIsSaving(true);
      try {
        const nowIso = new Date().toISOString();

        const insertPayload = {
          organization_id: organizationId,
          branch_id: branchId,
          amount: options.amount,
          transaction_id: options.transactionId || extractedData?.transaction_id || null,
          sender_name: options.senderName || extractedData?.sender_name || null,
          sender_account: extractedData?.sender_account || null,
          receiver_account: extractedData?.receiver_account || null,
          bank_comment: extractedData?.bank_comment || null,
          client_memo: options.memo || null,
          notes: options.notes || 'تم الإدراج عبر حساباتي سكانر',
          image_url: uploadedStoragePath,
          is_confirmed: true,
          confirmed_at: nowIso,
          transfer_date: extractedData?.date || nowIso.split('T')[0],
          ai_confidence: extractedData?.confidence || 90,
          extracted_data: extractedData ? (extractedData as any) : null,
          needs_review: false,
          is_manual_memo: Boolean(options.memo),
        };

        const { data: savedRecord, error: insertError } = await supabase
          .from('transfers')
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) {
          console.error('[useReceiptAnalyzer] Insert transfer error:', insertError);
          throw new Error(`تعذر حفظ العملية: ${insertError.message}`);
        }

        return savedRecord;
      } finally {
        setIsSaving(false);
      }
    },
    [organizationId, branchId, extractedData, uploadedStoragePath]
  );

  return {
    isAnalyzing,
    isSaving,
    analysisError,
    extractedData,
    duplicateResult,
    uploadedStoragePath,
    analyzeImage,
    confirmTransfer,
    reset,
  };
}
