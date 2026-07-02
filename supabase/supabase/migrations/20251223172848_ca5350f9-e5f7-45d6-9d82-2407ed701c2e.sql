-- Create a function to check if organization can add more branches
CREATE OR REPLACE FUNCTION public.can_add_branch(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)::int FROM public.branches WHERE organization_id = _organization_id
  ) < (
    SELECT max_branches FROM public.organizations WHERE id = _organization_id
  );
$$;

-- Create a function to check if organization can add more users
CREATE OR REPLACE FUNCTION public.can_add_user(_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)::int FROM public.user_roles WHERE organization_id = _organization_id
  ) < (
    SELECT max_users FROM public.organizations WHERE id = _organization_id
  );
$$;

-- Create a function to get organization limits with current usage
CREATE OR REPLACE FUNCTION public.get_organization_limits(_organization_id uuid)
RETURNS TABLE(
  max_branches int,
  current_branches bigint,
  max_users int,
  current_users bigint,
  plan_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    o.max_branches,
    (SELECT COUNT(*) FROM public.branches WHERE organization_id = _organization_id) as current_branches,
    o.max_users,
    (SELECT COUNT(*) FROM public.user_roles WHERE organization_id = _organization_id) as current_users,
    o.plan_type
  FROM public.organizations o
  WHERE o.id = _organization_id;
$$;

-- Create a trigger function to enforce branch limits
CREATE OR REPLACE FUNCTION public.check_branch_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count int;
  max_allowed int;
BEGIN
  SELECT COUNT(*)::int INTO current_count
  FROM public.branches
  WHERE organization_id = NEW.organization_id;
  
  SELECT max_branches INTO max_allowed
  FROM public.organizations
  WHERE id = NEW.organization_id;
  
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'BRANCH_LIMIT_EXCEEDED: لقد وصلت للحد الأقصى من الفروع (%) في خطتك الحالية. قم بترقية خطتك لإضافة المزيد.', max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a trigger function to enforce user limits
CREATE OR REPLACE FUNCTION public.check_user_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count int;
  max_allowed int;
BEGIN
  SELECT COUNT(*)::int INTO current_count
  FROM public.user_roles
  WHERE organization_id = NEW.organization_id;
  
  SELECT max_users INTO max_allowed
  FROM public.organizations
  WHERE id = NEW.organization_id;
  
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'USER_LIMIT_EXCEEDED: لقد وصلت للحد الأقصى من المستخدمين (%) في خطتك الحالية. قم بترقية خطتك لإضافة المزيد.', max_allowed;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for branch limit
DROP TRIGGER IF EXISTS enforce_branch_limit ON public.branches;
CREATE TRIGGER enforce_branch_limit
  BEFORE INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.check_branch_limit();

-- Create trigger for user limit  
DROP TRIGGER IF EXISTS enforce_user_limit ON public.user_roles;
CREATE TRIGGER enforce_user_limit
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_user_limit();