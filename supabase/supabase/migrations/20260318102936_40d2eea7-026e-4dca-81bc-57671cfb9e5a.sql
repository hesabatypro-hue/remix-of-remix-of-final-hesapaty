-- Fix linter-reported RLS issues related to recent trigger/security review

-- 1) Tighten organizations INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2) Tighten audit_logs INSERT policy
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated, service_role
WITH CHECK (
  (auth.uid() IS NOT NULL OR auth.role() = 'service_role')
  AND table_name <> ''
  AND action IN ('create', 'update', 'delete')
);

-- 3) Tighten notifications service-role INSERT policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (
  auth.role() = 'service_role'
  AND user_id IS NOT NULL
  AND title <> ''
  AND message <> ''
);

-- 4) Add explicit RLS policies for webhook_rate_limits
CREATE POLICY "Service role can view webhook rate limits"
ON public.webhook_rate_limits
FOR SELECT
TO service_role
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can insert webhook rate limits"
ON public.webhook_rate_limits
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update webhook rate limits"
ON public.webhook_rate_limits
FOR UPDATE
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');