-- Add per-org rate limit config
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 100;

-- Add fraud detection fields to transfers
ALTER TABLE public.transfers 
ADD COLUMN IF NOT EXISTS fraud_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS fraud_flags jsonb DEFAULT '[]'::jsonb;