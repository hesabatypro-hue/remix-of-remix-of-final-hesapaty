
-- Credit profile per organization (single-row config)
CREATE TABLE public.user_credit_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  credit_limit numeric NOT NULL DEFAULT 0,
  monthly_spend numeric NOT NULL DEFAULT 0,
  monthly_payment numeric NOT NULL DEFAULT 0,
  monthly_income_goal numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SDG',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

ALTER TABLE public.user_credit_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org credit profiles"
ON public.user_credit_profiles FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users insert own credit profile"
ON public.user_credit_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Users update own credit profile"
ON public.user_credit_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own credit profile"
ON public.user_credit_profiles FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_user_credit_profiles_updated
BEFORE UPDATE ON public.user_credit_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Investments
CREATE TABLE public.investment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  asset_name text NOT NULL,
  capital_amount numeric NOT NULL DEFAULT 0,
  expected_monthly_roi numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.investment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org investments"
ON public.investment_logs FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members insert investments"
ON public.investment_logs FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())) AND user_id = auth.uid());

CREATE POLICY "Owner updates investments"
ON public.investment_logs FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]))
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Owner deletes investments"
ON public.investment_logs FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_investment_logs_updated
BEFORE UPDATE ON public.investment_logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Financial milestones
CREATE TABLE public.financial_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  target_amount numeric,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view org milestones"
ON public.financial_milestones FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members insert milestones"
ON public.financial_milestones FOR INSERT TO authenticated
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())) AND user_id = auth.uid());

CREATE POLICY "Members update milestones"
ON public.financial_milestones FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]))
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Members delete milestones"
ON public.financial_milestones FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER trg_financial_milestones_updated
BEFORE UPDATE ON public.financial_milestones
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
