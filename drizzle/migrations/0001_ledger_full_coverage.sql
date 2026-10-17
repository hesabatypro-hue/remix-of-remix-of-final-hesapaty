CREATE OR REPLACE FUNCTION public.ledger_log_failure(_src text, _org uuid, _ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.system_logs(level, source, message, metadata, organization_id)
  VALUES ('error','ledger', 'Ledger posting failed: '||_src, jsonb_build_object('ref_id',_ref,'error',SQLERRM), _org);
EXCEPTION WHEN OTHERS THEN NULL; END; $$;
REVOKE EXECUTE ON FUNCTION public.ledger_log_failure(text,uuid,uuid) FROM PUBLIC, anon, authenticated;

-- Transfers: post on confirm, reverse on soft-delete of confirmed
CREATE OR REPLACE FUNCTION public.ledger_post_transfer()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.is_confirmed = true AND COALESCE(NEW.is_deleted,false)=false
     AND (TG_OP='INSERT' OR OLD.is_confirmed IS DISTINCT FROM NEW.is_confirmed) THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,'revenue','credit',NEW.amount,'SDG','transfer',NEW.id,
      jsonb_build_object('branch_id',NEW.branch_id,'transfer_date',NEW.transfer_date));
  END IF;
  IF TG_OP='UPDATE' AND NEW.is_deleted = true AND COALESCE(OLD.is_deleted,false)=false
     AND EXISTS (SELECT 1 FROM public.ledger_entries WHERE ref_type='transfer' AND ref_id=NEW.id AND entry_type='credit') THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,'revenue','debit',NEW.amount,'SDG','transfer',NEW.id,
      jsonb_build_object('reason','reversal_soft_delete','deleted_by',NEW.deleted_by));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN PERFORM public.ledger_log_failure('transfer',NEW.organization_id,NEW.id); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.ledger_post_expense()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _acct text := 'expense:' || COALESCE(NEW.category_id::text,'uncategorized');
BEGIN
  IF NEW.status='approved' AND COALESCE(NEW.is_deleted,false)=false
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,_acct,'debit',NEW.amount,'SDG','expense',NEW.id,
      jsonb_build_object('branch_id',NEW.branch_id,'expense_date',NEW.expense_date));
  END IF;
  IF TG_OP='UPDATE' AND NEW.is_deleted = true AND COALESCE(OLD.is_deleted,false)=false
     AND EXISTS (SELECT 1 FROM public.ledger_entries WHERE ref_type='expense' AND ref_id=NEW.id AND entry_type='debit') THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,_acct,'credit',NEW.amount,'SDG','expense',NEW.id,
      jsonb_build_object('reason','reversal_soft_delete'));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN PERFORM public.ledger_log_failure('expense',NEW.organization_id,NEW.id); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.ledger_post_invoice()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status='paid' AND COALESCE(NEW.is_deleted,false)=false
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,'revenue','credit',NEW.total_amount,COALESCE(NEW.currency,'SDG'),'invoice',NEW.id,
      jsonb_build_object('invoice_number',NEW.invoice_number,'to_client',NEW.to_client));
  END IF;
  IF TG_OP='UPDATE' AND NEW.is_deleted = true AND COALESCE(OLD.is_deleted,false)=false
     AND EXISTS (SELECT 1 FROM public.ledger_entries WHERE ref_type='invoice' AND ref_id=NEW.id AND entry_type='credit') THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,'revenue','debit',NEW.total_amount,COALESCE(NEW.currency,'SDG'),'invoice',NEW.id,
      jsonb_build_object('reason','reversal_soft_delete'));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN PERFORM public.ledger_log_failure('invoice',NEW.organization_id,NEW.id); RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.ledger_post_salary()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status='paid' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,'salary','debit',NEW.net_amount,'SDG','salary_payment',NEW.id,
      jsonb_build_object('employee_id',NEW.employee_id,'month',NEW.month,'year',NEW.year));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN PERFORM public.ledger_log_failure('salary',NEW.organization_id,NEW.id); RETURN NEW; END; $function$;

-- POS: post confirmed sales not backed by a linked transfer (avoids double counting)
CREATE OR REPLACE FUNCTION public.ledger_post_pos_invoice()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status='confirmed' AND NEW.transfer_id IS NULL
     AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.post_ledger_entry(NEW.organization_id,'revenue:pos','credit',NEW.total_amount,'SDG','pos_invoice',NEW.id,
      jsonb_build_object('branch_id',NEW.branch_id,'invoice_number',NEW.invoice_number,'payment_method',NEW.payment_method));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN PERFORM public.ledger_log_failure('pos_invoice',NEW.organization_id,NEW.id); RETURN NEW; END; $function$;

DROP TRIGGER IF EXISTS ledger_post_pos_invoice_trg ON public.pos_invoices;
CREATE TRIGGER ledger_post_pos_invoice_trg AFTER INSERT OR UPDATE ON public.pos_invoices
FOR EACH ROW EXECUTE FUNCTION public.ledger_post_pos_invoice();

REVOKE EXECUTE ON FUNCTION public.ledger_post_pos_invoice() FROM PUBLIC, anon, authenticated;

-- Reconciliation report for admins
CREATE OR REPLACE FUNCTION public.ledger_reconciliation(_organization_id uuid)
RETURNS TABLE(source text, missing_count bigint, missing_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner'::app_role,'admin'::app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT 'transfer', count(*), COALESCE(sum(t.amount),0) FROM transfers t
   WHERE t.organization_id=_organization_id AND t.is_confirmed AND NOT t.is_deleted
     AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.ref_type='transfer' AND l.ref_id=t.id)
  UNION ALL
  SELECT 'pos_invoice', count(*), COALESCE(sum(p.total_amount),0) FROM pos_invoices p
   WHERE p.organization_id=_organization_id AND p.status='confirmed' AND p.transfer_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.ref_type='pos_invoice' AND l.ref_id=p.id)
  UNION ALL
  SELECT 'expense', count(*), COALESCE(sum(e.amount),0) FROM expenses e
   WHERE e.organization_id=_organization_id AND e.status='approved' AND NOT e.is_deleted
     AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.ref_type='expense' AND l.ref_id=e.id)
  UNION ALL
  SELECT 'invoice', count(*), COALESCE(sum(i.total_amount),0) FROM invoices i
   WHERE i.organization_id=_organization_id AND i.status='paid' AND NOT i.is_deleted
     AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.ref_type='invoice' AND l.ref_id=i.id)
  UNION ALL
  SELECT 'salary', count(*), COALESCE(sum(s.net_amount),0) FROM salary_payments s
   WHERE s.organization_id=_organization_id AND s.status='paid'
     AND NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.ref_type='salary_payment' AND l.ref_id=s.id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.ledger_reconciliation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ledger_reconciliation(uuid) TO authenticated;