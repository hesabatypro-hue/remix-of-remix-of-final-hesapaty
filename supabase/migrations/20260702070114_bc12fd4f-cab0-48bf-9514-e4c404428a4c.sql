
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS notification_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  transfer_id uuid REFERENCES public.transfers(id) ON DELETE SET NULL,
  recipient_phone text,
  status text NOT NULL CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text])),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.whatsapp_notification_log TO authenticated;
GRANT ALL ON public.whatsapp_notification_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_log_org
  ON public.whatsapp_notification_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_notification_log_connection
  ON public.whatsapp_notification_log(connection_id);

ALTER TABLE public.whatsapp_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization notification log" ON public.whatsapp_notification_log;
CREATE POLICY "Users can view their organization notification log"
  ON public.whatsapp_notification_log FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

DROP POLICY IF EXISTS "Service role manages notification log" ON public.whatsapp_notification_log;
CREATE POLICY "Service role manages notification log"
  ON public.whatsapp_notification_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
