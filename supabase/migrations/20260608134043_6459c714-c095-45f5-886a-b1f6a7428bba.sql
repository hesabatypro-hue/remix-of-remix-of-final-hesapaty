
-- 1a. Soft-delete columns on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;
CREATE INDEX IF NOT EXISTS idx_invoices_org_active ON public.invoices(organization_id) WHERE is_deleted = false;

-- 1b. soft_delete_invoice RPC
CREATE OR REPLACE FUNCTION public.soft_delete_invoice(_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _org_id uuid;
BEGIN
  SELECT organization_id INTO _org_id FROM public.invoices WHERE id = _invoice_id AND is_deleted = false;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
  IF NOT public.has_organization_role(auth.uid(), _org_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.invoices
     SET is_deleted = true, deleted_at = now(), deleted_by = auth.uid(), updated_at = now()
   WHERE id = _invoice_id AND is_deleted = false;
  RETURN FOUND;
END;
$$;

-- 1c. Immutability triggers
CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- allow soft-delete transition
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN RETURN NEW; END IF;
  IF OLD.status = 'paid' THEN
    -- block status regression
    IF NEW.status <> 'paid' THEN RAISE EXCEPTION 'PAID_INVOICE_LOCKED'; END IF;
    IF NEW.invoice_number <> OLD.invoice_number
       OR NEW.invoice_date <> OLD.invoice_date
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.from_company <> OLD.from_company
       OR NEW.to_client <> OLD.to_client
       OR NEW.currency <> OLD.currency
       OR NEW.subtotal <> OLD.subtotal
       OR NEW.tax_rate <> OLD.tax_rate
       OR NEW.tax_amount <> OLD.tax_amount
       OR NEW.total_amount <> OLD.total_amount THEN
      RAISE EXCEPTION 'PAID_INVOICE_LOCKED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_paid_invoice_edit ON public.invoices;
CREATE TRIGGER prevent_paid_invoice_edit BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_invoice_edit();

CREATE OR REPLACE FUNCTION public.prevent_paid_invoice_items_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _status text; _inv_id uuid;
BEGIN
  _inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT status INTO _status FROM public.invoices WHERE id = _inv_id;
  IF _status = 'paid' THEN RAISE EXCEPTION 'PAID_INVOICE_LOCKED'; END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS prevent_paid_invoice_items_edit ON public.invoice_items;
CREATE TRIGGER prevent_paid_invoice_items_edit BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.prevent_paid_invoice_items_edit();

CREATE OR REPLACE FUNCTION public.prevent_approved_expense_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_deleted = true AND OLD.is_deleted = false THEN RETURN NEW; END IF;
  IF OLD.status = 'approved' THEN
    IF NEW.amount <> OLD.amount
       OR NEW.category_id IS DISTINCT FROM OLD.category_id
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
       OR NEW.expense_date <> OLD.expense_date
       OR NEW.receipt_image_url IS DISTINCT FROM OLD.receipt_image_url THEN
      RAISE EXCEPTION 'APPROVED_EXPENSE_LOCKED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_approved_expense_edit ON public.expenses;
CREATE TRIGGER prevent_approved_expense_edit BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_approved_expense_edit();

-- 1e. Drop hard-delete RLS policies (force RPC)
DROP POLICY IF EXISTS "Owners delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Owners can delete expenses" ON public.expenses;

-- 1d. Audit log hardening
ALTER TABLE public.audit_logs ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _org_id uuid; _action text; _record_id text; _uid uuid;
BEGIN
  _uid := auth.uid();
  IF TG_OP = 'DELETE' THEN
    _action := 'delete'; _org_id := OLD.organization_id; _record_id := OLD.id::text;
    INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, record_id, old_data)
      VALUES (_org_id, _uid, _action, TG_TABLE_NAME, _record_id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update'; _org_id := NEW.organization_id; _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, record_id, old_data, new_data)
      VALUES (_org_id, _uid, _action, TG_TABLE_NAME, _record_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _action := 'create'; _org_id := NEW.organization_id; _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, record_id, new_data)
      VALUES (_org_id, _uid, _action, TG_TABLE_NAME, _record_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- invoice_items has no organization_id column -> use a dedicated audit trigger
CREATE OR REPLACE FUNCTION public.audit_log_invoice_items_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org_id uuid; _uid uuid; _inv_id uuid;
BEGIN
  _uid := auth.uid();
  _inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT organization_id INTO _org_id FROM public.invoices WHERE id = _inv_id;
  IF _org_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, record_id, old_data)
      VALUES (_org_id, _uid, 'delete', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, record_id, old_data, new_data)
      VALUES (_org_id, _uid, 'update', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO public.audit_logs (organization_id, user_id, action, table_name, record_id, new_data)
      VALUES (_org_id, _uid, 'create', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$;

-- Attach audit triggers
DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_invoice_items ON public.invoice_items;
CREATE TRIGGER audit_invoice_items AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_invoice_items_trigger();

DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_salary_payments ON public.salary_payments;
CREATE TRIGGER audit_salary_payments AFTER INSERT OR UPDATE OR DELETE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_platform_invoices ON public.platform_invoices;
CREATE TRIGGER audit_platform_invoices AFTER INSERT OR UPDATE OR DELETE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_whatsapp_credentials ON public.whatsapp_credentials;
CREATE TRIGGER audit_whatsapp_credentials AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
