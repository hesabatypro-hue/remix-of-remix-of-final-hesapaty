-- Function to create notifications for organization members when a new transfer is received
CREATE OR REPLACE FUNCTION public.notify_new_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_record RECORD;
  _branch_name TEXT;
  _amount_text TEXT;
BEGIN
  -- Only notify for WhatsApp transfers (those with whatsapp_connection_id)
  IF NEW.whatsapp_connection_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get branch name
  SELECT name INTO _branch_name
  FROM public.branches
  WHERE id = NEW.branch_id;

  -- Format amount
  _amount_text := TO_CHAR(NEW.amount, 'FM999,999,999.00');

  -- Create notification for all users in the organization
  FOR _user_record IN
    SELECT user_id FROM public.user_roles
    WHERE organization_id = NEW.organization_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      organization_id,
      title,
      message,
      type,
      link
    ) VALUES (
      _user_record.user_id,
      NEW.organization_id,
      'تحويل جديد عبر WhatsApp',
      'تم استلام تحويل بقيمة ' || _amount_text || ' ر.س في فرع ' || COALESCE(_branch_name, 'غير محدد'),
      'transfer',
      '/transfers'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on transfers table
DROP TRIGGER IF EXISTS on_new_transfer_notify ON public.transfers;
CREATE TRIGGER on_new_transfer_notify
  AFTER INSERT ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_transfer();

-- Allow service role to insert notifications (for edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);