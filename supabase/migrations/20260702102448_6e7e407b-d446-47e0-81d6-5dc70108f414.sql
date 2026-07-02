-- Add dedicated chat_id column to whatsapp_messages so the confirmation reply
-- can reliably target the exact origin chat (esp. groups) instead of parsing
-- it out of the free-text content column.
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS chat_id text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_id
  ON public.whatsapp_messages(chat_id);

COMMENT ON COLUMN public.whatsapp_messages.chat_id IS
  'WhatsApp chat/group id where message originated (e.g. 12036...@g.us). Used to reply in-thread.';
