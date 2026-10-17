
-- 1) Notifications: restrict INSERT policy to authenticated role
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 2) whatsapp_messages: add DELETE policy (owners/admins only)
CREATE POLICY "Owners and admins can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO authenticated
USING (
  has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role])
);

-- 3) user_roles: block client-side bootstrap self-insert.
-- Only SECURITY DEFINER context (current_user = postgres) or an existing
-- owner/admin in the org may insert rows.
CREATE OR REPLACE FUNCTION public.check_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role app_role;
BEGIN
  -- Trusted server context (SECURITY DEFINER RPCs, service role, migrations)
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  -- Must have an existing owner/admin role in the target organization
  SELECT role INTO _caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND organization_id = NEW.organization_id
    AND role IN ('owner','admin')
  ORDER BY get_role_level(role) DESC
  LIMIT 1;

  IF _caller_role IS NULL THEN
    RAISE EXCEPTION 'ROLE_BOOTSTRAP_DENIED: roles can only be bootstrapped via create_organization_with_owner';
  END IF;

  -- Prevent assigning a role >= caller's role
  IF get_role_level(NEW.role) >= get_role_level(_caller_role) THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_DENIED: Cannot assign a role equal to or higher than your own';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_role_escalation_trigger ON public.user_roles;
CREATE TRIGGER check_role_escalation_trigger
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.check_role_escalation();

-- 4) Revoke EXECUTE from authenticated on internal SECURITY DEFINER helpers
-- that are only meant to be called by RLS policies/triggers, not by clients.
REVOKE EXECUTE ON FUNCTION public.find_branch_by_name(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_ledger_chain(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_full_access(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_add_branch(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_add_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_organization_role(uuid, uuid, app_role[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_organization_ids(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_branch_id(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.find_branch_by_chat_id(uuid, text) FROM authenticated;
