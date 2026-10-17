ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS webhook_secret_installed_at timestamptz;