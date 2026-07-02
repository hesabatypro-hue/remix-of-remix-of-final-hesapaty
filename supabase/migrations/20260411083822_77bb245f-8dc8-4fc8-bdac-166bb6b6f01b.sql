DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;

CREATE POLICY "Admins can update expenses"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  public.has_organization_role(
    auth.uid(),
    organization_id,
    ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role]
  )
)
WITH CHECK (
  public.has_organization_role(
    auth.uid(),
    organization_id,
    ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role]
  )
);
