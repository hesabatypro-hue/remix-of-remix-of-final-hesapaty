-- 1) Restrict employees SELECT to managers+ (hide base_salary from regular members)
DROP POLICY IF EXISTS "Members can view employees" ON public.employees;
CREATE POLICY "Managers can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

-- 2) Restrict audit_logs SELECT to owners/admins only
DROP POLICY IF EXISTS "Users can view their organization audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

-- 3) Hide Stripe billing IDs from non-admins via column-level privileges.
-- Revoke SELECT on the whole org table for authenticated, then grant SELECT on
-- only the non-sensitive columns. RLS still applies on top of these grants.
REVOKE SELECT ON public.organizations FROM authenticated;
GRANT SELECT (
  id, name, slug, logo_url, plan_type, subscription_status,
  subscription_ends_at, max_branches, max_users, industry_type,
  rate_limit_per_minute, created_at, updated_at
) ON public.organizations TO authenticated;
-- Owners/admins can still update; grant explicit update privileges
GRANT INSERT, UPDATE ON public.organizations TO authenticated;
