
-- Remove duplicate triggers
DROP TRIGGER IF EXISTS prevent_confirmed_transfer_edit ON public.transfers;
DROP TRIGGER IF EXISTS audit_logs_transfers_trigger ON public.transfers;
DROP TRIGGER IF EXISTS notify_on_new_transfer ON public.transfers;
DROP TRIGGER IF EXISTS validate_transfer_amount ON public.transfers;

-- Create secure function for bulk soft delete
CREATE OR REPLACE FUNCTION public.soft_delete_all_transfers(_organization_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  -- Verify caller is a member
  IF NOT is_organization_member(auth.uid(), _organization_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: ليس لديك صلاحية لهذه العملية';
  END IF;

  UPDATE public.transfers
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = auth.uid(),
    updated_at = now()
  WHERE organization_id = _organization_id
    AND is_deleted = false;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
