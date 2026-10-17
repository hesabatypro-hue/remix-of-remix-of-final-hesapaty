
-- 1) employees: restrict SELECT to owner/admin only
DROP POLICY IF EXISTS "Managers can view employees" ON public.employees;
CREATE POLICY "Owners and admins can view employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

-- 2) salary_payments: restrict SELECT to owner/admin only
DROP POLICY IF EXISTS "Members can view salary payments" ON public.salary_payments;
CREATE POLICY "Owners and admins can view salary payments"
  ON public.salary_payments FOR SELECT
  TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

-- 3) transfers: restrict SELECT to owner/admin/manager (exclude viewer)
DROP POLICY IF EXISTS "Users can view their organization transfers" ON public.transfers;
CREATE POLICY "Managers and above can view transfers"
  ON public.transfers FOR SELECT
  TO authenticated
  USING (
    has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role])
    AND is_deleted = false
  );

-- 4) whatsapp_connections: restrict SELECT to owner/admin only
DROP POLICY IF EXISTS "Users can view their organization whatsapp connections" ON public.whatsapp_connections;
CREATE POLICY "Owners and admins can view whatsapp connections"
  ON public.whatsapp_connections FOR SELECT
  TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

-- 5) ai_rate_limits: add SELECT policy scoped to owner
CREATE POLICY "Users can view their own rate limits"
  ON public.ai_rate_limits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 6) storage: drop the public listing policy on org-logos (public URLs still work via the bucket's public flag)
DROP POLICY IF EXISTS "Public can view org logos" ON storage.objects;
CREATE POLICY "Members can view org logos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- 7) function search_path: fix the one function missing it
ALTER FUNCTION public.ledger_block_mutation() SET search_path = public;

-- 8) Revoke EXECUTE on all SECURITY DEFINER functions from PUBLIC and anon, then grant back
--    to authenticated only for the ones needed at runtime (RLS helpers + client-callable RPCs).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- RLS helpers must remain callable by authenticated users so policies can evaluate.
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, uuid, app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organization_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_branch_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_full_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_branch_by_chat_id(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_branch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_limits(uuid) TO authenticated;

-- Client-callable RPCs
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_all_transfers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_expense(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_ledger_chain(uuid) TO authenticated;
