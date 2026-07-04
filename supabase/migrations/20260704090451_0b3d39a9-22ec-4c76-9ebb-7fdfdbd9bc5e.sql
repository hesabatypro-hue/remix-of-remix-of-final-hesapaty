
-- 1. تفعيل POS على مستوى المؤسسة
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_pos_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_activated_at timestamptz;

-- 2. get_role_level يدعم cashier
CREATE OR REPLACE FUNCTION public.get_role_level(_role app_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 4
    WHEN 'admin' THEN 3
    WHEN 'manager' THEN 2
    WHEN 'cashier' THEN 1
    WHEN 'viewer' THEN 1
    ELSE 0
  END;
$$;

-- 3. جدول المنتجات
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  barcode text,
  product_name text NOT NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  default_sale_price numeric NOT NULL DEFAULT 0,
  category text,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_org_barcode
  ON public.products(organization_id, barcode) WHERE barcode IS NOT NULL AND is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_products_org_active ON public.products(organization_id, is_active) WHERE is_deleted = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view products" ON public.products FOR SELECT TO authenticated
  USING (is_organization_member(auth.uid(), organization_id) AND is_deleted = false);
CREATE POLICY "Managers insert products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));
CREATE POLICY "Managers update products" ON public.products FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));
CREATE POLICY "Admins delete products" ON public.products FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. مخزون الفروع
CREATE TABLE IF NOT EXISTS public.branch_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_quantity numeric NOT NULL DEFAULT 0,
  custom_sale_price numeric,
  low_stock_threshold numeric NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, product_id)
);
CREATE INDEX IF NOT EXISTS ix_branch_inv_branch ON public.branch_inventory(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_inventory TO authenticated;
GRANT ALL ON public.branch_inventory TO service_role;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View branch inventory" ON public.branch_inventory FOR SELECT TO authenticated
  USING (
    has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])
    OR (is_organization_member(auth.uid(), organization_id)
        AND branch_id = get_user_branch_id(auth.uid(), organization_id))
  );
CREATE POLICY "Managers insert branch inventory" ON public.branch_inventory FOR INSERT TO authenticated
  WITH CHECK (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));
CREATE POLICY "Managers update branch inventory" ON public.branch_inventory FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));
CREATE POLICY "Admins delete branch inventory" ON public.branch_inventory FOR DELETE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role]));

CREATE TRIGGER update_branch_inventory_updated_at BEFORE UPDATE ON public.branch_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. فواتير POS
CREATE TABLE IF NOT EXISTS public.pos_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  cashier_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash','bank_transfer','card')),
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending_image','confirmed','cancelled','ghost')),
  transfer_id uuid REFERENCES public.transfers(id) ON DELETE SET NULL,
  bank_reference text,
  client_local_id text,
  notes text,
  created_at_local timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, client_local_id)
);
CREATE INDEX IF NOT EXISTS ix_pos_inv_org_status ON public.pos_invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS ix_pos_inv_branch ON public.pos_invoices(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_pos_inv_pending_match
  ON public.pos_invoices(organization_id, total_amount, created_at)
  WHERE status = 'pending_image';

GRANT SELECT, INSERT, UPDATE ON public.pos_invoices TO authenticated;
GRANT ALL ON public.pos_invoices TO service_role;
ALTER TABLE public.pos_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pos invoices" ON public.pos_invoices FOR SELECT TO authenticated
  USING (
    has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])
    OR (is_organization_member(auth.uid(), organization_id)
        AND branch_id = get_user_branch_id(auth.uid(), organization_id))
  );
CREATE POLICY "Members insert pos invoices" ON public.pos_invoices FOR INSERT TO authenticated
  WITH CHECK (
    is_organization_member(auth.uid(), organization_id)
    AND (
      has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])
      OR branch_id = get_user_branch_id(auth.uid(), organization_id)
    )
  );
CREATE POLICY "Managers update pos invoices" ON public.pos_invoices FOR UPDATE TO authenticated
  USING (has_organization_role(auth.uid(), organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role]));

CREATE TRIGGER update_pos_invoices_updated_at BEFORE UPDATE ON public.pos_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prevent_confirmed_pos_invoice_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'confirmed' AND NEW.status = 'confirmed' THEN
    IF NEW.total_amount <> OLD.total_amount
       OR NEW.branch_id <> OLD.branch_id
       OR NEW.invoice_number <> OLD.invoice_number
       OR NEW.payment_method <> OLD.payment_method THEN
      RAISE EXCEPTION 'CONFIRMED_POS_INVOICE_LOCKED';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prevent_confirmed_pos_invoice_edit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_confirmed_pos_invoice_edit_trg
  BEFORE UPDATE ON public.pos_invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_pos_invoice_edit();

CREATE TRIGGER audit_pos_invoices AFTER INSERT OR UPDATE OR DELETE ON public.pos_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- 6. عناصر الفاتورة
CREATE TABLE IF NOT EXISTS public.pos_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.pos_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pos_items_invoice ON public.pos_invoice_items(invoice_id);

GRANT SELECT, INSERT ON public.pos_invoice_items TO authenticated;
GRANT ALL ON public.pos_invoice_items TO service_role;
ALTER TABLE public.pos_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pos items via invoice" ON public.pos_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id
    AND (has_organization_role(auth.uid(), i.organization_id, ARRAY['owner'::app_role,'admin'::app_role,'manager'::app_role])
         OR (is_organization_member(auth.uid(), i.organization_id)
             AND i.branch_id = get_user_branch_id(auth.uid(), i.organization_id)))));
CREATE POLICY "Insert pos items via invoice" ON public.pos_invoice_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.pos_invoices i WHERE i.id = invoice_id
    AND is_organization_member(auth.uid(), i.organization_id)));

CREATE OR REPLACE FUNCTION public.deduct_pos_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _branch uuid;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT branch_id INTO _branch FROM public.pos_invoices WHERE id = NEW.invoice_id;
  UPDATE public.branch_inventory
    SET stock_quantity = stock_quantity - NEW.quantity, updated_at = now()
    WHERE branch_id = _branch AND product_id = NEW.product_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.deduct_pos_inventory() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER deduct_pos_inventory_trg
  AFTER INSERT ON public.pos_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_pos_inventory();

-- 7. دوال المطابقة والبحث
CREATE OR REPLACE FUNCTION public.match_pending_pos_invoice(
  _org uuid, _amount numeric, _timestamp timestamptz,
  _transfer_id uuid DEFAULT NULL, _bank_ref text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _match_id uuid;
BEGIN
  SELECT id INTO _match_id
  FROM public.pos_invoices
  WHERE organization_id = _org
    AND status = 'pending_image'
    AND ABS(total_amount - _amount) < 0.01
    AND created_at BETWEEN (_timestamp - interval '15 minutes') AND (_timestamp + interval '15 minutes')
  ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - _timestamp)))
  LIMIT 1;

  IF _match_id IS NOT NULL THEN
    UPDATE public.pos_invoices
      SET status = 'confirmed',
          transfer_id = COALESCE(_transfer_id, transfer_id),
          bank_reference = COALESCE(_bank_ref, bank_reference),
          updated_at = now()
      WHERE id = _match_id;
  END IF;
  RETURN _match_id;
END $$;
REVOKE ALL ON FUNCTION public.match_pending_pos_invoice(uuid, numeric, timestamptz, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_pending_pos_invoice(uuid, numeric, timestamptz, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.find_branch_by_name(_org uuid, _name text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.branches
   WHERE organization_id = _org
     AND is_deleted = false
     AND is_active = true
     AND (LOWER(name) = LOWER(_name) OR LOWER(name) LIKE '%' || LOWER(_name) || '%')
   ORDER BY (LOWER(name) = LOWER(_name)) DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_branch_by_name(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_branch_by_name(uuid, text) TO service_role, authenticated;

-- 8. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_invoices;
