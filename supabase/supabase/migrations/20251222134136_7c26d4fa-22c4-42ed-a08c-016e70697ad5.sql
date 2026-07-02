-- Create organization + owner role atomically to satisfy SELECT RLS after creation
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  _name text,
  _slug text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org public.organizations;
BEGIN
  -- Ensure caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.organizations (
    name,
    slug,
    plan_type,
    subscription_status,
    max_branches,
    max_users
  )
  VALUES (
    _name,
    _slug,
    'free',
    'active',
    2,
    3
  )
  RETURNING * INTO _org;

  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), _org.id, 'owner');

  RETURN _org;
END;
$$;

-- Lock down and grant execute to authenticated users
REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;