
-- =============================================
-- 1. Failed Jobs Queue (Message Queue replacement)
-- =============================================
CREATE TABLE public.failed_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL, -- 'image_upload', 'ai_analysis', 'transfer_insert'
  payload jsonb NOT NULL,
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  next_retry_at timestamp with time zone DEFAULT now(),
  organization_id uuid REFERENCES public.organizations(id),
  whatsapp_message_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  last_attempted_at timestamp with time zone
);

-- Index for retry worker
CREATE INDEX idx_failed_jobs_retry ON public.failed_jobs (status, next_retry_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_failed_jobs_org ON public.failed_jobs (organization_id);

-- RLS
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view failed jobs" ON public.failed_jobs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Service role can manage failed jobs" ON public.failed_jobs
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- =============================================
-- 2. System Logs table for Monitoring
-- =============================================
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'error', -- 'info', 'warn', 'error', 'fatal'
  source text NOT NULL, -- 'meta-webhook', 'green-api-webhook', 'extract-transfer', 'keep-alive'
  message text NOT NULL,
  metadata jsonb,
  organization_id uuid,
  connection_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_logs_level ON public.system_logs (level, created_at DESC);
CREATE INDEX idx_system_logs_source ON public.system_logs (source, created_at DESC);
CREATE INDEX idx_system_logs_org ON public.system_logs (organization_id, created_at DESC);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system logs" ON public.system_logs
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Service role can insert system logs" ON public.system_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =============================================
-- 3. Re-create ALL missing triggers
-- =============================================
CREATE OR REPLACE TRIGGER audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_whatsapp_connections
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER enforce_branch_limit
  BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.check_branch_limit();

CREATE OR REPLACE TRIGGER enforce_user_limit
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.check_user_limit();

CREATE OR REPLACE TRIGGER notify_on_new_transfer
  AFTER INSERT ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_transfer();

CREATE OR REPLACE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. Per-Organization Rate Limiting (upgrade table)
-- =============================================
ALTER TABLE public.webhook_rate_limits 
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_rate_limits_org ON public.webhook_rate_limits (organization_id, window_start);

-- =============================================
-- 5. Vault functions for secure token storage
-- =============================================
CREATE OR REPLACE FUNCTION public.store_connection_token(
  _connection_id uuid,
  _token_name text,
  _token_value text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _secret_name text;
BEGIN
  _secret_name := 'conn_' || _connection_id::text || '_' || _token_name;
  -- Try to update existing, if not exists insert
  PERFORM vault.create_secret(_token_value, _secret_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_connection_token(
  _connection_id uuid,
  _token_name text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _secret_name text;
  _token text;
BEGIN
  _secret_name := 'conn_' || _connection_id::text || '_' || _token_name;
  SELECT decrypted_secret INTO _token
  FROM vault.decrypted_secrets
  WHERE name = _secret_name;
  RETURN _token;
END;
$$;
