-- Fix webhook_rate_limits: add RLS policies (service_role only)
CREATE POLICY "Service role manages webhook rate limits"
ON public.webhook_rate_limits FOR ALL TO service_role USING (true);

-- Fix audit_logs: replace overly permissive insert policy
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);