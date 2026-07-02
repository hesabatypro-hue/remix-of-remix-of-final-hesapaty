CREATE OR REPLACE FUNCTION public.soft_delete_expense(_expense_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  SELECT organization_id
  INTO _org_id
  FROM public.expenses
  WHERE id = _expense_id
    AND is_deleted = false;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'EXPENSE_NOT_FOUND: المصروف غير موجود أو تم حذفه بالفعل';
  END IF;

  IF NOT public.has_organization_role(
    auth.uid(),
    _org_id,
    ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role]
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: ليس لديك صلاحية حذف هذا المصروف';
  END IF;

  UPDATE public.expenses
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now()
  WHERE id = _expense_id
    AND is_deleted = false;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_expense(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_expense(uuid) TO authenticated;