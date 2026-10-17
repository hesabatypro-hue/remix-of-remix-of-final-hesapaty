-- Fix: Allow client_memo updates on confirmed transfers (for delayed memo linking)
CREATE OR REPLACE FUNCTION public.prevent_confirmed_transfer_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow soft-delete on confirmed transfers
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
    RETURN NEW;
  END IF;

  -- Allow client_memo updates on confirmed transfers (delayed memo linking)
  IF OLD.is_confirmed = true THEN
    -- Only allow if the change is limited to client_memo / is_manual_memo / updated_at
    IF NEW.amount = OLD.amount
       AND NEW.branch_id = OLD.branch_id
       AND NEW.is_confirmed = OLD.is_confirmed
       AND NEW.is_deleted = OLD.is_deleted
       AND NEW.image_url IS NOT DISTINCT FROM OLD.image_url
       AND NEW.sender_phone IS NOT DISTINCT FROM OLD.sender_phone
       AND NEW.sender_name IS NOT DISTINCT FROM OLD.sender_name
       AND NEW.transaction_id IS NOT DISTINCT FROM OLD.transaction_id
    THEN
      RETURN NEW; -- allow memo-only edits
    END IF;
    RAISE EXCEPTION 'CONFIRMED_TRANSFER';
  END IF;

  RETURN NEW;
END;
$$;

-- Smart expense alert function
CREATE OR REPLACE FUNCTION public.check_expense_alert_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total_expenses numeric;
  _total_revenue numeric;
  _ratio numeric;
  _threshold numeric := 0.80;
  _user_record RECORD;
BEGIN
  -- Calculate current month expenses
  SELECT COALESCE(SUM(amount), 0) INTO _total_expenses
  FROM public.expenses
  WHERE organization_id = NEW.organization_id
    AND is_deleted = false
    AND EXTRACT(MONTH FROM expense_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM expense_date) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Calculate current month revenue
  SELECT COALESCE(SUM(amount), 0) INTO _total_revenue
  FROM public.transfers
  WHERE organization_id = NEW.organization_id
    AND is_deleted = false
    AND EXTRACT(MONTH FROM transfer_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(YEAR FROM transfer_date) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Only alert if there's revenue to compare against
  IF _total_revenue > 0 THEN
    _ratio := _total_expenses / _total_revenue;

    IF _ratio >= _threshold THEN
      FOR _user_record IN
        SELECT user_id FROM public.user_roles
        WHERE organization_id = NEW.organization_id
          AND role IN ('owner', 'admin')
      LOOP
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
        VALUES (
          _user_record.user_id,
          NEW.organization_id,
          '⚠️ تنبيه: المصروفات مرتفعة',
          'المصروفات الشهرية بلغت ' || ROUND(_ratio * 100) || '% من الإيرادات (' ||
          TO_CHAR(_total_expenses, 'FM999,999,999') || ' من أصل ' ||
          TO_CHAR(_total_revenue, 'FM999,999,999') || ' ر.س)',
          'expense_alert',
          '/financial-reports'
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the alert trigger to expenses table
DROP TRIGGER IF EXISTS expense_alert_trigger ON public.expenses;
CREATE TRIGGER expense_alert_trigger
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.check_expense_alert_on_insert();