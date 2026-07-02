
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS invoicing_enabled boolean NOT NULL DEFAULT false;

GRANT SELECT (invoicing_enabled), UPDATE (invoicing_enabled) ON public.organizations TO authenticated;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  from_company text NOT NULL,
  from_address text,
  from_email text,
  to_client text NOT NULL,
  to_address text,
  to_email text,
  project_name text,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view invoices" ON public.invoices FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins create invoices" ON public.invoices FOR INSERT TO authenticated
WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

CREATE POLICY "Admins update invoices" ON public.invoices FOR UPDATE TO authenticated
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

CREATE POLICY "Owners delete invoices" ON public.invoices FOR DELETE TO authenticated
USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE POLICY "Members view invoice items" ON public.invoice_items FOR SELECT TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE organization_id IN (SELECT get_user_organization_ids(auth.uid()))));

CREATE POLICY "Admins create invoice items" ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])));

CREATE POLICY "Admins update invoice items" ON public.invoice_items FOR UPDATE TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])));

CREATE POLICY "Admins delete invoice items" ON public.invoice_items FOR DELETE TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])));

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
