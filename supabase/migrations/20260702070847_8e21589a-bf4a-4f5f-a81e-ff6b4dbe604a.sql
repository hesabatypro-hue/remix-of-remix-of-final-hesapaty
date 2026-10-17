ALTER TABLE public.whatsapp_notification_log REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_notification_log;