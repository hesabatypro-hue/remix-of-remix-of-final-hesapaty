ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS whatsapp_liability_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_liability_accepted_by uuid,
  ADD COLUMN IF NOT EXISTS whatsapp_liability_version text;

CREATE TABLE IF NOT EXISTS public.org_ai_rate_limits (
  organization_id uuid NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, endpoint, window_start)
);

GRANT SELECT ON public.org_ai_rate_limits TO authenticated;
GRANT ALL ON public.org_ai_rate_limits TO service_role;

ALTER TABLE public.org_ai_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org ai usage" ON public.org_ai_rate_limits;
CREATE POLICY "Members can view org ai usage"
  ON public.org_ai_rate_limits FOR SELECT TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id));

CREATE INDEX IF NOT EXISTS idx_org_ai_rate_limits_window ON public.org_ai_rate_limits (window_start);

CREATE OR REPLACE FUNCTION public.check_and_increment_org_ai_rate_limit(
  _organization_id uuid, _endpoint text, _limit integer, _window_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _bucket timestamptz; _count integer;
BEGIN
  IF _organization_id IS NULL THEN RETURN false; END IF;
  _bucket := to_timestamp(floor(extract(epoch from now()) / GREATEST(_window_seconds,1)) * GREATEST(_window_seconds,1));

  INSERT INTO public.org_ai_rate_limits (organization_id, endpoint, window_start, request_count)
  VALUES (_organization_id, _endpoint, _bucket, 1)
  ON CONFLICT (organization_id, endpoint, window_start)
  DO UPDATE SET request_count = public.org_ai_rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  DELETE FROM public.org_ai_rate_limits WHERE window_start < now() - interval '1 day';

  RETURN _count <= _limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_org_ai_rate_limit(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_org_ai_rate_limit(uuid, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_whatsapp_liability(_organization_id uuid, _version text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner'::app_role,'admin'::app_role]) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;
  UPDATE public.organizations
     SET whatsapp_liability_accepted_at = now(),
         whatsapp_liability_accepted_by = auth.uid(),
         whatsapp_liability_version = _version,
         updated_at = now()
   WHERE id = _organization_id;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_whatsapp_liability(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_whatsapp_liability(uuid, text) TO authenticated, service_role;