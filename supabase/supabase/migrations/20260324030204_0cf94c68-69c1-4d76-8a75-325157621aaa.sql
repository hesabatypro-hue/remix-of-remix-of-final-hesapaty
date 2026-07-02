
-- Add missing columns to transfers table for AI processing pipeline
ALTER TABLE public.transfers 
  ADD COLUMN IF NOT EXISTS image_hash text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_confidence integer DEFAULT NULL;

-- Add index for duplicate image detection
CREATE INDEX IF NOT EXISTS idx_transfers_image_hash ON public.transfers(image_hash) WHERE image_hash IS NOT NULL AND is_deleted = false;

-- Add index for needs_review queries
CREATE INDEX IF NOT EXISTS idx_transfers_needs_review ON public.transfers(needs_review) WHERE needs_review = true AND is_deleted = false;
