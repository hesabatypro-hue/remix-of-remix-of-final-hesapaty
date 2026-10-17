-- Replace generic audit trigger on whatsapp_credentials with a dedicated one that
-- resolves organization_id via the parent whatsapp_connections row (the table itself has no organization_id column).

CREATE OR REPLACE FUNCTION public.audit_whatsapp_credentials_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _uid uuid;
  _conn_id uuid;
BEGIN
  _uid := auth.uid();
  _conn_id := COALESCE(NEW.connection_id, OLD.connection_id);
  SELECT organization_id INTO _org_id FROM public.whatsapp_connections WHERE id = _conn_id;
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

DROP TRIGGER IF EXISTS audit_whatsapp_credentials ON public.whatsapp_credentials;
CREATE TRIGGER audit_whatsapp_credentials
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_credentials
  FOR EACH ROW EXECUTE FUNCTION public.audit_whatsapp_credentials_fn();
