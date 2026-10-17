export type ScannerPhase = 
  | 'idle'
  | 'streaming'
  | 'capturing'
  | 'analyzing'
  | 'verifying'
  | 'confirmed'
  | 'error';

export interface ExtractedReceiptData {
  amount: number | null;
  date: string | null;
  sender_name: string | null;
  transaction_id: string | null;
  receiver_account: string | null;
  sender_account: string | null;
  bank_comment: string | null;
  reference_number: string | null;
  confidence: number;
  bank_name?: string | null;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingTransferId?: string;
  existingCreatedAt?: string;
  existingAmount?: number;
}

export interface CapturedImagePayload {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface ScannerSettings {
  facingMode: 'environment' | 'user';
  soundEnabled: boolean;
  hapticEnabled: boolean;
  autoAnalyze: boolean;
}
