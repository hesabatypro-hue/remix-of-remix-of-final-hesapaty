
-- 1. Remove overly permissive policy on expenses
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.expenses;

-- 2. Add UPDATE and DELETE storage policies for receipts (org admins/owners)
CREATE POLICY "Org admins can update receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT (organizations.id)::text
    FROM organizations
    WHERE organizations.id IN (
      SELECT get_user_organization_ids(auth.uid())
    )
  )
  AND public.has_organization_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::app_role, 'admin'::app_role]
  )
);

CREATE POLICY "Org admins can delete receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] IN (
    SELECT (organizations.id)::text
    FROM organizations
    WHERE organizations.id IN (
      SELECT get_user_organization_ids(auth.uid())
    )
  )
  AND public.has_organization_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['owner'::app_role, 'admin'::app_role]
  )
);

-- 3. Revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
-- that are trigger-only or internal helpers and should not be RPC-callable.
REVOKE EXECUTE ON FUNCTION public.audit_log_trigger() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_branch_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_user_limit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_role_escalation() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.check_expense_alert_on_insert() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.deduct_inventory_on_print() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_new_transfer() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_confirmed_transfer_edit() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_organization_role(uuid, uuid, app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_ids(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_branch_id(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_full_access(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.find_branch_by_chat_id(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_role_level(app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- Anon must not be able to call RPC entry points
REVOKE EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.soft_delete_all_transfers(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.soft_delete_expense(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_organization_limits(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_add_branch(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_add_user(uuid) FROM anon, public;

-- 4. Add channel authorization on realtime.messages so only authenticated
-- users can read/write realtime broadcast/presence messages.
-- (postgres_changes still gated by RLS on source tables.)
DROP POLICY IF EXISTS "Authenticated can read realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated can write realtime messages" ON realtime.messages;
CREATE POLICY "Authenticated can write realtime messages"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
