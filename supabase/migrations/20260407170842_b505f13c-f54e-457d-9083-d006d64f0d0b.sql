
-- =============================================
-- 1. Separate WhatsApp credentials into restricted table
-- =============================================
CREATE TABLE public.whatsapp_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL UNIQUE REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  access_token text,
  green_api_token text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can view credentials
CREATE POLICY "Admins can view credentials" ON public.whatsapp_credentials
  FOR SELECT TO authenticated
  USING (
    connection_id IN (
      SELECT wc.id FROM public.whatsapp_connections wc
      WHERE has_organization_role(auth.uid(), wc.organization_id, ARRAY['owner'::app_role, 'admin'::app_role])
    )
  );

CREATE POLICY "Admins can insert credentials" ON public.whatsapp_credentials
  FOR INSERT TO authenticated
  WITH CHECK (
    connection_id IN (
      SELECT wc.id FROM public.whatsapp_connections wc
      WHERE has_organization_role(auth.uid(), wc.organization_id, ARRAY['owner'::app_role, 'admin'::app_role])
    )
  );

CREATE POLICY "Admins can update credentials" ON public.whatsapp_credentials
  FOR UPDATE TO authenticated
  USING (
    connection_id IN (
      SELECT wc.id FROM public.whatsapp_connections wc
      WHERE has_organization_role(auth.uid(), wc.organization_id, ARRAY['owner'::app_role, 'admin'::app_role])
    )
  );

CREATE POLICY "Service role manages credentials" ON public.whatsapp_credentials
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Migrate existing tokens to new table
INSERT INTO public.whatsapp_credentials (connection_id, access_token, green_api_token)
SELECT id, access_token, green_api_token FROM public.whatsapp_connections
WHERE access_token IS NOT NULL OR green_api_token IS NOT NULL;

-- Remove sensitive columns from whatsapp_connections
ALTER TABLE public.whatsapp_connections DROP COLUMN IF EXISTS access_token;
ALTER TABLE public.whatsapp_connections DROP COLUMN IF EXISTS green_api_token;

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_credentials_updated_at
  BEFORE UPDATE ON public.whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Prevent privilege escalation in user_roles
-- =============================================
CREATE OR REPLACE FUNCTION public.get_role_level(_role app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'manager' THEN 2
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role app_role;
BEGIN
  -- Skip check for service_role (used by create_organization_with_owner)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Get caller's role in this organization
  SELECT role INTO _caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND organization_id = NEW.organization_id
  LIMIT 1;

  -- Prevent assigning a role >= caller's role
  IF get_role_level(NEW.role) >= get_role_level(_caller_role) THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_DENIED: Cannot assign a role equal to or higher than your own';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_role_escalation
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.check_role_escalation();

-- =============================================
-- 3. Allow org members to view colleague profiles
-- =============================================
CREATE POLICY "Org members can view colleague profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.organization_id IN (SELECT get_user_organization_ids(auth.uid()))
    )
  );
