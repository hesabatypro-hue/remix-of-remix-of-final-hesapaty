
-- Add new financial columns to transfers table
ALTER TABLE public.transfers
ADD COLUMN IF NOT EXISTS transaction_id text,
ADD COLUMN IF NOT EXISTS client_memo text,
ADD COLUMN IF NOT EXISTS is_manual_memo boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receiver_account text,
ADD COLUMN IF NOT EXISTS sender_account text,
ADD COLUMN IF NOT EXISTS bank_comment text;

-- Create unique index on transaction_id per organization to prevent duplicate notifications
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_transaction_id_unique
ON public.transfers (organization_id, transaction_id)
WHERE transaction_id IS NOT NULL AND is_deleted = false;

-- Create index for searching by transaction_id
CREATE INDEX IF NOT EXISTS idx_transfers_transaction_id
ON public.transfers (transaction_id)
WHERE transaction_id IS NOT NULL;

-- Create index for receiver_account searches
CREATE INDEX IF NOT EXISTS idx_transfers_receiver_account
ON public.transfers (receiver_account)
WHERE receiver_account IS NOT NULL;
