-- Security and Authorization Hardening Migration

-- 1) Restrict mark_platform_invoice_paid to service_role only (prevents customer admins from marking their own subscription invoices as paid)
CREATE OR REPLACE FUNCTION public.mark_platform_invoice_paid(
  _invoice_id uuid,
  _reference text DEFAULT NULL,
  _method text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _org_id uuid;
BEGIN
  SELECT organization_id INTO _org_id FROM public.platform_invoices WHERE id = _invoice_id;
  IF _org_id IS NULL THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;

  -- Only service_role or platform super-admins can mark platform billing invoices paid
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Only platform administrators can confirm subscription payments' USING ERRCODE = '42501';
  END IF;

  UPDATE public.platform_invoices
     SET status = 'paid',
         paid_at = now(),
         payment_reference = _reference,
         payment_method = _method,
         updated_at = now()
   WHERE id = _invoice_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) TO service_role;


-- 2) Fix soft_delete_all_transfers: enforce owner or admin role (prevent viewer/manager privilege escalation)
CREATE OR REPLACE FUNCTION public.soft_delete_all_transfers(_organization_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE _count integer;
BEGIN
  IF NOT public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED: Only organization owners and admins can reset all transfers' USING ERRCODE = '42501';
  END IF;

  UPDATE public.transfers
     SET is_deleted = true,
         deleted_at = now(),
         deleted_by = auth.uid(),
         updated_at = now()
   WHERE organization_id = _organization_id
     AND is_deleted = false;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;


-- 3) Fix branch limit counting: filter out soft-deleted branches (is_deleted = false)
-- and lock organization row to prevent concurrent race condition bypasses
CREATE OR REPLACE FUNCTION public.check_branch_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  current_count int;
  max_allowed int;
BEGIN
  -- Prevent concurrent branch insertion limit bypass by locking organization row
  PERFORM 1 FROM public.organizations WHERE id = NEW.organization_id FOR UPDATE;

  SELECT COUNT(*)::int INTO current_count
    FROM public.branches
   WHERE organization_id = NEW.organization_id
     AND is_deleted = false;

  SELECT max_branches INTO max_allowed
    FROM public.organizations
   WHERE id = NEW.organization_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'BRANCH_LIMIT_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_branch(_organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT COUNT(*)::int FROM public.branches WHERE organization_id = _organization_id AND is_deleted = false) <
         (SELECT max_branches FROM public.organizations WHERE id = _organization_id);
$$;

CREATE OR REPLACE FUNCTION public.get_organization_limits(_organization_id UUID)
RETURNS TABLE(max_branches int, current_branches bigint, max_users int, current_users bigint, plan_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT o.max_branches,
         (SELECT COUNT(*) FROM public.branches WHERE organization_id = _organization_id AND is_deleted = false),
         o.max_users,
         (SELECT COUNT(*) FROM public.user_roles WHERE organization_id = _organization_id),
         o.plan_type
    FROM public.organizations o
   WHERE o.id = _organization_id;
$$;


-- 4) Harden transfers table RLS: restrict INSERT and UPDATE to owner, admin, manager (block viewer tampering)
DROP POLICY IF EXISTS "Members can create transfers" ON public.transfers;
CREATE POLICY "Managers and above can create transfers"
  ON public.transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_organization_role(auth.uid(), organization_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role])
  );

DROP POLICY IF EXISTS "Members can update transfers" ON public.transfers;
CREATE POLICY "Managers and above can update transfers"
  ON public.transfers FOR UPDATE
  TO authenticated
  USING (
    public.has_organization_role(auth.uid(), organization_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role])
  )
  WITH CHECK (
    public.has_organization_role(auth.uid(), organization_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role, 'manager'::public.app_role])
  );

-- 5) Protect confirmed transfers from unauthorized deletion: only owners and admins can soft-delete confirmed transfers
CREATE OR REPLACE FUNCTION public.prevent_confirmed_transfer_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF OLD.is_confirmed = true THEN
    -- If trying to soft-delete a confirmed transfer, verify caller is owner or admin
    IF NEW.is_deleted = true AND OLD.is_deleted = false THEN
      IF NOT public.has_organization_role(auth.uid(), OLD.organization_id, ARRAY['owner'::public.app_role, 'admin'::public.app_role]) THEN
        RAISE EXCEPTION 'NOT_AUTHORIZED: Only owners and admins can delete confirmed transfers' USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'CONFIRMED_TRANSFER: Confirmed transfers cannot be modified' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
