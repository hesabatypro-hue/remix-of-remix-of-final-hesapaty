
-- =============================================
-- 1. Expense Categories
-- =============================================
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  icon text DEFAULT 'receipt',
  color text DEFAULT '#6366f1',
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_categories_org ON public.expense_categories (organization_id);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expense categories" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can create expense categories" ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admins can update expense categories" ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Owners can delete expense categories" ON public.expense_categories
  FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Expenses
-- =============================================
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  category_id uuid REFERENCES public.expense_categories(id),
  amount numeric NOT NULL,
  description text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_image_url text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_type text, -- 'daily', 'weekly', 'monthly', 'yearly'
  status text NOT NULL DEFAULT 'approved', -- 'pending', 'approved', 'rejected'
  created_by uuid,
  approved_by uuid,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_org ON public.expenses (organization_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON public.expenses (category_id);
CREATE INDEX idx_expenses_branch ON public.expenses (branch_id);
CREATE INDEX idx_expenses_active ON public.expenses (organization_id) WHERE is_deleted = false;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())) AND is_deleted = false);

CREATE POLICY "Admins can create expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admins can update expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Owners can delete expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validate expense amount
CREATE OR REPLACE FUNCTION public.validate_expense_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_EXPENSE_AMOUNT';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_expense_amount_trigger
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_expense_amount();

-- Audit trigger for expenses
CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- =============================================
-- 3. Employees
-- =============================================
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid REFERENCES public.branches(id),
  full_name text NOT NULL,
  position text,
  base_salary numeric NOT NULL DEFAULT 0,
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_org ON public.employees (organization_id);
CREATE INDEX idx_employees_branch ON public.employees (branch_id);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view employees" ON public.employees
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can create employees" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admins can update employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Owners can delete employees" ON public.employees
  FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 4. Salary Payments
-- =============================================
CREATE TABLE public.salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  base_amount numeric NOT NULL,
  deductions numeric NOT NULL DEFAULT 0,
  bonuses numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL,
  paid_at timestamp with time zone,
  paid_by uuid,
  notes text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month, year)
);

CREATE INDEX idx_salary_payments_org ON public.salary_payments (organization_id, year, month);
CREATE INDEX idx_salary_payments_employee ON public.salary_payments (employee_id);

ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view salary payments" ON public.salary_payments
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can create salary payments" ON public.salary_payments
  FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Admins can update salary payments" ON public.salary_payments
  FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Owners can delete salary payments" ON public.salary_payments
  FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role]));

CREATE TRIGGER update_salary_payments_updated_at
  BEFORE UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
