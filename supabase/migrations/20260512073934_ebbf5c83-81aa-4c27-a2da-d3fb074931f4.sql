
-- Subscription plans catalog
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  description_en text,
  price_usd numeric NOT NULL DEFAULT 0,
  billing_cycle text NOT NULL DEFAULT 'monthly', -- monthly | yearly | lifetime
  max_users integer NOT NULL DEFAULT 3,
  max_branches integer NOT NULL DEFAULT 2,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active plans"
ON public.subscription_plans FOR SELECT TO authenticated
USING (is_active = true);

CREATE TRIGGER trg_subscription_plans_updated
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.subscription_plans (code, name_en, description_en, price_usd, billing_cycle, max_users, max_branches, sort_order, features) VALUES
('free',      'Hisabaty Free',           'Basic plan for individuals',                     0,    'monthly',  3,   2,   0, '["Basic features","Up to 3 users","Up to 2 branches"]'::jsonb),
('pro',       'Hisabaty Pro Monthly',    'Pro plan billed monthly',                        29,   'monthly',  10,  5,   1, '["All features","Up to 10 users","Up to 5 branches","Priority support"]'::jsonb),
('pro_yearly','Hisabaty Pro Yearly',     'Pro plan billed yearly (2 months free)',         290,  'yearly',   10,  5,   2, '["All features","Up to 10 users","Up to 5 branches","Priority support","Save 17%"]'::jsonb),
('enterprise','Hisabaty Enterprise',     'Enterprise plan with unlimited resources',       99,   'monthly',  9999,9999,3, '["Unlimited users","Unlimited branches","Dedicated support","Custom integrations"]'::jsonb);

-- Sequence for invoice numbers
CREATE SEQUENCE public.platform_invoice_seq START 1;

-- Platform invoices (issued by Suda-Technologies LLC to organizations)
CREATE TABLE public.platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  plan_code text,
  invoice_number text NOT NULL UNIQUE,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  period_start date,
  period_end date,
  description text,
  amount_usd numeric NOT NULL DEFAULT 0,
  tax_usd numeric NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  from_company text NOT NULL DEFAULT 'Suda-Technologies LLC',
  from_address text NOT NULL DEFAULT '1209 Mountain Road Pl NE, Ste R, Albuquerque, NM 87110, USA',
  from_email text NOT NULL DEFAULT 'billing@suda-technologies.com',
  to_organization_name text NOT NULL,
  to_email text,
  status text NOT NULL DEFAULT 'issued', -- issued | paid | void
  paid_at timestamptz,
  payment_reference text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_invoices_org ON public.platform_invoices(organization_id, issue_date DESC);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins view platform invoices"
ON public.platform_invoices FOR SELECT TO authenticated
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE POLICY "Service role manages platform invoices"
ON public.platform_invoices FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE TRIGGER trg_platform_invoices_updated
BEFORE UPDATE ON public.platform_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate the next invoice number like STP-2026-0001
CREATE OR REPLACE FUNCTION public.generate_platform_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n bigint;
BEGIN
  _n := nextval('public.platform_invoice_seq');
  RETURN 'STP-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(_n::text, 4, '0');
END;
$$;

-- Function: issue an invoice for a given organization based on its current plan
CREATE OR REPLACE FUNCTION public.issue_platform_invoice_for_org(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org public.organizations%ROWTYPE;
  _plan public.subscription_plans%ROWTYPE;
  _to_email text;
  _period_end date;
  _invoice_id uuid;
BEGIN
  SELECT * INTO _org FROM public.organizations WHERE id = _org_id;
  IF _org.id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _plan FROM public.subscription_plans WHERE code = _org.plan_type LIMIT 1;
  -- Skip free plan
  IF _plan.id IS NULL OR _plan.price_usd = 0 THEN RETURN NULL; END IF;

  -- Get owner email
  SELECT p.email INTO _to_email
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.organization_id = _org_id AND ur.role = 'owner'
  LIMIT 1;

  IF _plan.billing_cycle = 'yearly' THEN
    _period_end := CURRENT_DATE + INTERVAL '1 year';
  ELSIF _plan.billing_cycle = 'lifetime' THEN
    _period_end := CURRENT_DATE + INTERVAL '100 years';
  ELSE
    _period_end := CURRENT_DATE + INTERVAL '1 month';
  END IF;

  INSERT INTO public.platform_invoices (
    organization_id, plan_id, plan_code, invoice_number,
    issue_date, due_date, period_start, period_end,
    description, amount_usd, total_usd,
    to_organization_name, to_email, status
  ) VALUES (
    _org_id, _plan.id, _plan.code, public.generate_platform_invoice_number(),
    CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE, _period_end,
    _plan.name_en || ' Subscription', _plan.price_usd, _plan.price_usd,
    _org.name, _to_email, 'issued'
  ) RETURNING id INTO _invoice_id;

  -- Notify organization owners/admins
  INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
  SELECT ur.user_id, _org_id,
    'Subscription invoice issued',
    'Invoice for ' || _plan.name_en || ' ($' || _plan.price_usd || ') has been issued.',
    'invoice', '/subscription-invoices'
  FROM public.user_roles ur
  WHERE ur.organization_id = _org_id AND ur.role IN ('owner', 'admin');

  RETURN _invoice_id;
END;
$$;

-- Trigger function on organizations: issue invoice when plan_type changes to a paid plan
CREATE OR REPLACE FUNCTION public.trg_organizations_issue_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.plan_type IS DISTINCT FROM 'free')
     OR (TG_OP = 'UPDATE' AND NEW.plan_type IS DISTINCT FROM OLD.plan_type AND NEW.plan_type IS DISTINCT FROM 'free')
  THEN
    PERFORM public.issue_platform_invoice_for_org(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_issue_platform_invoice
AFTER INSERT OR UPDATE OF plan_type ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.trg_organizations_issue_invoice();

-- RPC so admins can manually mark an invoice as paid
CREATE OR REPLACE FUNCTION public.mark_platform_invoice_paid(_invoice_id uuid, _reference text DEFAULT NULL, _method text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _org_id uuid;
BEGIN
  SELECT organization_id INTO _org_id FROM public.platform_invoices WHERE id = _invoice_id;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
  IF NOT public.has_organization_role(auth.uid(), _org_id, ARRAY['owner'::app_role, 'admin'::app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.platform_invoices
     SET status = 'paid', paid_at = now(), payment_reference = _reference, payment_method = _method, updated_at = now()
   WHERE id = _invoice_id;
  RETURN FOUND;
END;
$$;
