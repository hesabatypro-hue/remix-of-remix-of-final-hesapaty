
-- Ensure pgcrypto exists (in extensions schema on Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Enum
DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  account         text NOT NULL,
  entry_type      public.ledger_entry_type NOT NULL,
  amount          numeric(18,2) NOT NULL CHECK (amount > 0),
  currency        text NOT NULL DEFAULT 'SDG',
  ref_type        text NOT NULL,
  ref_id          uuid NOT NULL,
  posted_at       timestamptz NOT NULL DEFAULT now(),
  prev_hash       text,
  hash            text NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_unique_ref
  ON public.ledger_entries (organization_id, ref_type, ref_id, account, entry_type);
CREATE INDEX IF NOT EXISTS ledger_entries_org_posted_idx
  ON public.ledger_entries (organization_id, posted_at DESC);

GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL    ON public.ledger_entries TO service_role;

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view ledger" ON public.ledger_entries;
CREATE POLICY "Org members can view ledger"
  ON public.ledger_entries FOR SELECT TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id));

-- Immutability
CREATE OR REPLACE FUNCTION public.ledger_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LEDGER_IMMUTABLE: ledger_entries is append-only';
END; $$;

DROP TRIGGER IF EXISTS ledger_no_update ON public.ledger_entries;
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_block_mutation();
DROP TRIGGER IF EXISTS ledger_no_delete ON public.ledger_entries;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_block_mutation();

-- Core posting function
CREATE OR REPLACE FUNCTION public.post_ledger_entry(
  _organization_id uuid,
  _account         text,
  _entry_type      public.ledger_entry_type,
  _amount          numeric,
  _currency        text,
  _ref_type        text,
  _ref_id          uuid,
  _metadata        jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _prev_hash text;
  _payload   text;
  _hash      text;
  _id        uuid;
  _lock_key  bigint;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN NULL; END IF;

  _lock_key := ('x' || substr(md5(_organization_id::text), 1, 15))::bit(60)::bigint;
  PERFORM pg_advisory_xact_lock(_lock_key);

  SELECT id INTO _id FROM public.ledger_entries
   WHERE organization_id = _organization_id AND ref_type = _ref_type
     AND ref_id = _ref_id AND account = _account AND entry_type = _entry_type
   LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  SELECT hash INTO _prev_hash FROM public.ledger_entries
   WHERE organization_id = _organization_id
   ORDER BY posted_at DESC, created_at DESC LIMIT 1;

  _payload := COALESCE(_prev_hash,'') || '|' || _organization_id::text || '|' ||
              _account || '|' || _entry_type::text || '|' || _amount::text || '|' ||
              _currency || '|' || _ref_type || '|' || _ref_id::text || '|' ||
              COALESCE(_metadata::text, '{}');

  _hash := encode(extensions.digest(convert_to(_payload, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.ledger_entries (
    organization_id, account, entry_type, amount, currency,
    ref_type, ref_id, prev_hash, hash, metadata, created_by
  ) VALUES (
    _organization_id, _account, _entry_type, _amount, COALESCE(_currency,'SDG'),
    _ref_type, _ref_id, _prev_hash, _hash, COALESCE(_metadata,'{}'::jsonb), auth.uid()
  )
  ON CONFLICT (organization_id, ref_type, ref_id, account, entry_type) DO NOTHING
  RETURNING id INTO _id;

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.post_ledger_entry(uuid, text, public.ledger_entry_type, numeric, text, text, uuid, jsonb) FROM PUBLIC;

-- Chain verifier
CREATE OR REPLACE FUNCTION public.verify_ledger_chain(_organization_id uuid)
RETURNS TABLE(broken_at_id uuid, broken_at_posted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r record; expected_prev text := NULL; expected_hash text; payload text;
BEGIN
  IF NOT public.is_organization_member(auth.uid(), _organization_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  FOR r IN SELECT * FROM public.ledger_entries
            WHERE organization_id = _organization_id
            ORDER BY posted_at ASC, created_at ASC LOOP
    payload := COALESCE(expected_prev,'') || '|' || r.organization_id::text || '|' ||
               r.account || '|' || r.entry_type::text || '|' || r.amount::text || '|' ||
               r.currency || '|' || r.ref_type || '|' || r.ref_id::text || '|' ||
               COALESCE(r.metadata::text,'{}');
    expected_hash := encode(extensions.digest(convert_to(payload,'UTF8'),'sha256'),'hex');
    IF r.prev_hash IS DISTINCT FROM expected_prev OR r.hash <> expected_hash THEN
      broken_at_id := r.id; broken_at_posted_at := r.posted_at;
      RETURN NEXT; RETURN;
    END IF;
    expected_prev := r.hash;
  END LOOP;
END; $$;

-- Auto-posting triggers
CREATE OR REPLACE FUNCTION public.ledger_post_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_confirmed = true AND COALESCE(NEW.is_deleted,false)=false
     AND (TG_OP='INSERT' OR OLD.is_confirmed IS DISTINCT FROM NEW.is_confirmed) THEN
    PERFORM public.post_ledger_entry(
      NEW.organization_id, 'revenue', 'credit', NEW.amount, 'SDG',
      'transfer', NEW.id,
      jsonb_build_object('branch_id', NEW.branch_id, 'transfer_date', NEW.transfer_date)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS ledger_post_transfer_trg ON public.transfers;
CREATE TRIGGER ledger_post_transfer_trg AFTER INSERT OR UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.ledger_post_transfer();

CREATE OR REPLACE FUNCTION public.ledger_post_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='paid' AND COALESCE(NEW.is_deleted,false)=false
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(
      NEW.organization_id, 'revenue', 'credit', NEW.total_amount, COALESCE(NEW.currency,'SDG'),
      'invoice', NEW.id,
      jsonb_build_object('invoice_number', NEW.invoice_number, 'to_client', NEW.to_client)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS ledger_post_invoice_trg ON public.invoices;
CREATE TRIGGER ledger_post_invoice_trg AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.ledger_post_invoice();

CREATE OR REPLACE FUNCTION public.ledger_post_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='approved' AND COALESCE(NEW.is_deleted,false)=false
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(
      NEW.organization_id,
      'expense:' || COALESCE(NEW.category_id::text,'uncategorized'),
      'debit', NEW.amount, 'SDG',
      'expense', NEW.id,
      jsonb_build_object('branch_id', NEW.branch_id, 'expense_date', NEW.expense_date)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS ledger_post_expense_trg ON public.expenses;
CREATE TRIGGER ledger_post_expense_trg AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.ledger_post_expense();

CREATE OR REPLACE FUNCTION public.ledger_post_salary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status='paid'
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(
      NEW.organization_id, 'salary', 'debit', NEW.net_amount, 'SDG',
      'salary_payment', NEW.id,
      jsonb_build_object('employee_id', NEW.employee_id, 'month', NEW.month, 'year', NEW.year)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS ledger_post_salary_trg ON public.salary_payments;
CREATE TRIGGER ledger_post_salary_trg AFTER INSERT OR UPDATE ON public.salary_payments
  FOR EACH ROW EXECUTE FUNCTION public.ledger_post_salary();

-- Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public.transfers
            WHERE is_confirmed=true AND COALESCE(is_deleted,false)=false
            ORDER BY organization_id, created_at LOOP
    PERFORM public.post_ledger_entry(r.organization_id,'revenue','credit',r.amount,'SDG','transfer',r.id,
      jsonb_build_object('branch_id',r.branch_id,'transfer_date',r.transfer_date,'backfill',true));
  END LOOP;
  FOR r IN SELECT * FROM public.invoices
            WHERE status='paid' AND COALESCE(is_deleted,false)=false
            ORDER BY organization_id, created_at LOOP
    PERFORM public.post_ledger_entry(r.organization_id,'revenue','credit',r.total_amount,COALESCE(r.currency,'SDG'),'invoice',r.id,
      jsonb_build_object('invoice_number',r.invoice_number,'backfill',true));
  END LOOP;
  FOR r IN SELECT * FROM public.expenses
            WHERE status='approved' AND COALESCE(is_deleted,false)=false
            ORDER BY organization_id, created_at LOOP
    PERFORM public.post_ledger_entry(r.organization_id,
      'expense:' || COALESCE(r.category_id::text,'uncategorized'),
      'debit',r.amount,'SDG','expense',r.id,
      jsonb_build_object('branch_id',r.branch_id,'expense_date',r.expense_date,'backfill',true));
  END LOOP;
  FOR r IN SELECT * FROM public.salary_payments
            WHERE status='paid' ORDER BY organization_id, created_at LOOP
    PERFORM public.post_ledger_entry(r.organization_id,'salary','debit',r.net_amount,'SDG','salary_payment',r.id,
      jsonb_build_object('employee_id',r.employee_id,'backfill',true));
  END LOOP;
END $$;
