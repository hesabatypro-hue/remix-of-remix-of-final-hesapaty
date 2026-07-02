
-- 1. Trigger: منع تعديل التحويل المؤكد
CREATE OR REPLACE FUNCTION public.prevent_confirmed_transfer_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- السماح بـ soft delete فقط
  IF OLD.is_confirmed = true AND NOT (
    NEW.is_deleted = true AND OLD.is_deleted = false
  ) THEN
    RAISE EXCEPTION 'CONFIRMED_TRANSFER: لا يمكن تعديل تحويل مؤكد';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_confirmed_transfer_edit ON public.transfers;
CREATE TRIGGER prevent_confirmed_transfer_edit
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_confirmed_transfer_edit();

-- 2. Trigger: التحقق من أن المبلغ أكبر من صفر
CREATE OR REPLACE FUNCTION public.validate_transfer_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: المبلغ يجب أن يكون أكبر من صفر';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_transfer_amount ON public.transfers;
CREATE TRIGGER validate_transfer_amount
  BEFORE INSERT OR UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transfer_amount();

-- 3. Trigger: Audit log للتحويلات
DROP TRIGGER IF EXISTS audit_transfers ON public.transfers;
CREATE TRIGGER audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();

-- 4. Trigger: Audit log للفروع
DROP TRIGGER IF EXISTS audit_branches ON public.branches;
CREATE TRIGGER audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();

-- 5. Trigger: حدود الفروع
DROP TRIGGER IF EXISTS enforce_branch_limit ON public.branches;
CREATE TRIGGER enforce_branch_limit
  BEFORE INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.check_branch_limit();

-- 6. Trigger: حدود المستخدمين
DROP TRIGGER IF EXISTS enforce_user_limit ON public.user_roles;
CREATE TRIGGER enforce_user_limit
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_limit();

-- 7. Trigger: إشعار تحويل جديد
DROP TRIGGER IF EXISTS notify_on_new_transfer ON public.transfers;
CREATE TRIGGER notify_on_new_transfer
  AFTER INSERT ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_transfer();

-- 8. Trigger: تحديث updated_at تلقائياً
DROP TRIGGER IF EXISTS update_transfers_updated_at ON public.transfers;
CREATE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON public.whatsapp_connections;
CREATE TRIGGER update_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
