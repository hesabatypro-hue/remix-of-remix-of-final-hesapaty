CREATE OR REPLACE FUNCTION public.check_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role app_role;
  _existing_count int;
BEGIN
  -- Allow bootstrap: if the organization has no roles yet, this is the founder's owner row.
  SELECT COUNT(*) INTO _existing_count
  FROM public.user_roles
  WHERE organization_id = NEW.organization_id;

  IF _existing_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Get caller's role in this organization
  SELECT role INTO _caller_role
  FROM public.user_roles
  WHERE user_id = auth.uid() AND organization_id = NEW.organization_id
  LIMIT 1;

  -- If caller has no role in the org (e.g. service_role / admin action), allow
  IF _caller_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent assigning a role >= caller's role
  IF get_role_level(NEW.role) >= get_role_level(_caller_role) THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_DENIED: Cannot assign a role equal to or higher than your own';
  END IF;

  RETURN NEW;
END;
$$;