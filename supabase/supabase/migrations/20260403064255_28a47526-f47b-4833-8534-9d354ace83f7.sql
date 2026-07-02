
ALTER TABLE public.whatsapp_connections
ADD COLUMN monitored_chat_id text DEFAULT NULL,
ADD COLUMN monitored_chat_name text DEFAULT NULL;

COMMENT ON COLUMN public.whatsapp_connections.monitored_chat_id IS 'WhatsApp group/chat JID to monitor exclusively. NULL = all chats.';
COMMENT ON COLUMN public.whatsapp_connections.monitored_chat_name IS 'Display name of the monitored group for UI.';
