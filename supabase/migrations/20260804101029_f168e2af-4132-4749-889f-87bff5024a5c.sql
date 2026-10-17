REVOKE SELECT ON public.whatsapp_credentials FROM authenticated;
REVOKE SELECT ON public.whatsapp_credentials FROM anon;
GRANT SELECT (id, connection_id, created_at) ON public.whatsapp_credentials TO authenticated;
GRANT ALL ON public.whatsapp_credentials TO service_role;