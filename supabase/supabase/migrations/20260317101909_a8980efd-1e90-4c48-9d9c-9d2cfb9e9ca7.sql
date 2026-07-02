-- Enable realtime on transfers and whatsapp_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;