
-- Create print_orders table
CREATE TABLE public.print_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  customer_name TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'banner',
  width NUMERIC NOT NULL DEFAULT 0,
  height NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_area NUMERIC GENERATED ALWAYS AS (width * height * quantity) STORED,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (width * height * quantity * unit_price) STORED,
  file_path TEXT,
  designer_id UUID REFERENCES public.employees(id),
  printer_id UUID REFERENCES public.employees(id),
  status TEXT NOT NULL DEFAULT 'draft',
  commission_rate NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view print orders"
  ON public.print_orders FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can create print orders"
  ON public.print_orders FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Admins can update print orders"
  ON public.print_orders FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Owners can delete print orders"
  ON public.print_orders FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role, 'admin'::app_role]));

-- Updated at trigger
CREATE TRIGGER update_print_orders_updated_at
  BEFORE UPDATE ON public.print_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
