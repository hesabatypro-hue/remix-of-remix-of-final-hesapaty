-- Soft-delete duplicate rows by image_hash (keep earliest)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY organization_id, image_hash ORDER BY created_at ASC, id ASC) AS rn
  FROM public.transfers
  WHERE image_hash IS NOT NULL AND is_deleted = false
)
UPDATE public.transfers t
   SET is_deleted = true, deleted_at = now(), updated_at = now()
  FROM ranked r
 WHERE t.id = r.id AND r.rn > 1;

-- Soft-delete duplicate rows by transaction_id (keep earliest)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY organization_id, transaction_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.transfers
  WHERE transaction_id IS NOT NULL AND is_deleted = false
)
UPDATE public.transfers t
   SET is_deleted = true, deleted_at = now(), updated_at = now()
  FROM ranked r
 WHERE t.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS public.idx_transfers_image_hash;
DROP INDEX IF EXISTS public.idx_transfers_transaction_id_unique;

CREATE UNIQUE INDEX idx_transfers_image_hash
  ON public.transfers (organization_id, image_hash)
  WHERE image_hash IS NOT NULL AND is_deleted = false;

CREATE UNIQUE INDEX idx_transfers_transaction_id_unique
  ON public.transfers (organization_id, transaction_id)
  WHERE transaction_id IS NOT NULL AND is_deleted = false;