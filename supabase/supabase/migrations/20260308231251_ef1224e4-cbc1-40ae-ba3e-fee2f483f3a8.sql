
-- Fix overly permissive RLS policies on failed_jobs and system_logs

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Service role can manage failed jobs" ON public.failed_jobs;
DROP POLICY IF EXISTS "Service role can insert system logs" ON public.system_logs;

-- Replace with proper policies for failed_jobs
CREATE POLICY "Service role insert failed jobs" ON public.failed_jobs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Service role update failed jobs" ON public.failed_jobs
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Replace with proper policy for system_logs
CREATE POLICY "Members can insert system logs" ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));
