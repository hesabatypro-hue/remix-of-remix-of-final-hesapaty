DROP POLICY IF EXISTS "Members can update transfers" ON public.transfers;
CREATE POLICY "Managers can update transfers" ON public.transfers
FOR UPDATE TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]))
WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

CREATE OR REPLACE FUNCTION public.soft_delete_all_transfers(_organization_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _count integer;
BEGIN
  IF NOT public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner'::app_role,'admin'::app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.transfers SET is_deleted = true, deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
   WHERE organization_id = _organization_id AND is_deleted = false;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) TO service_role;