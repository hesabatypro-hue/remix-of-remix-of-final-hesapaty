
-- ============================================
-- 1. DATABASE INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transfers_org_created ON public.transfers (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_org_confirmed ON public.transfers (organization_id, is_confirmed);
CREATE INDEX IF NOT EXISTS idx_transfers_branch_date ON public.transfers (branch_id, transfer_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages (message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org_created ON public.whatsapp_messages (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_meta_phone ON public.whatsapp_connections (meta_phone_number_id) WHERE meta_phone_number_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_green_instance ON public.whatsapp_connections (green_api_instance_id) WHERE green_api_instance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_org_read ON public.notifications (user_id, organization_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_org ON public.user_roles (user_id, organization_id);

-- ============================================
-- 2. RATE LIMITING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE(connection_id)
);

ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. AUDIT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);

-- RLS: Only org members can view audit logs
CREATE POLICY "Users can view their organization audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

-- Service role inserts via triggers
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 4. AUDIT LOG TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _action text;
  _record_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _org_id := OLD.organization_id;
    _record_id := OLD.id::text;
    INSERT INTO public.audit_logs (organization_id, action, table_name, record_id, old_data)
    VALUES (_org_id, _action, TG_TABLE_NAME, _record_id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _org_id := NEW.organization_id;
    _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (organization_id, action, table_name, record_id, old_data, new_data)
    VALUES (_org_id, _action, TG_TABLE_NAME, _record_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _action := 'create';
    _org_id := NEW.organization_id;
    _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (organization_id, action, table_name, record_id, new_data)
    VALUES (_org_id, _action, TG_TABLE_NAME, _record_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to main tables
CREATE TRIGGER audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER audit_whatsapp_connections
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- ============================================
-- 5. SOFT DELETE COLUMNS
-- ============================================
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_transfers_not_deleted ON public.transfers (organization_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_branches_not_deleted ON public.branches (organization_id) WHERE is_deleted = false;

-- Update RLS policies to exclude soft-deleted records for SELECT
DROP POLICY IF EXISTS "Users can view their organization transfers" ON public.transfers;
CREATE POLICY "Users can view their organization transfers"
  ON public.transfers FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_organization_ids(auth.uid()))
    AND is_deleted = false
  );

DROP POLICY IF EXISTS "Users can view their organization branches" ON public.branches;
CREATE POLICY "Users can view their organization branches"
  ON public.branches FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT get_user_organization_ids(auth.uid()))
    AND is_deleted = false
  );
