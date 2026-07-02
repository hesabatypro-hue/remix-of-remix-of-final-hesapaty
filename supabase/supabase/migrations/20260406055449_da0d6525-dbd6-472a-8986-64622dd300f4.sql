
-- 1. Add branch_id to user_roles (nullable - null means access to all branches)
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 2. Add whatsapp_chat_id to branches for group-based routing
ALTER TABLE public.branches 
ADD COLUMN IF NOT EXISTS whatsapp_chat_id text;

-- 3. Create index for fast branch lookup by chat_id
CREATE INDEX IF NOT EXISTS idx_branches_whatsapp_chat_id 
ON public.branches(whatsapp_chat_id) 
WHERE whatsapp_chat_id IS NOT NULL;

-- 4. Create index for user_roles branch lookup
CREATE INDEX IF NOT EXISTS idx_user_roles_branch_id 
ON public.user_roles(branch_id) 
WHERE branch_id IS NOT NULL;

-- 5. Security definer function to get user's branch_id for RLS
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id uuid, _organization_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id 
  FROM public.user_roles 
  WHERE user_id = _user_id 
    AND organization_id = _organization_id
  LIMIT 1;
$$;

-- 6. Function to check if user has full org access (owner/admin have null branch_id)
CREATE OR REPLACE FUNCTION public.user_has_full_access(_user_id uuid, _organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _organization_id
      AND (branch_id IS NULL OR role = ANY(ARRAY['owner'::app_role, 'admin'::app_role]))
  );
$$;

-- 7. Smart routing function: find branch by chat_id
CREATE OR REPLACE FUNCTION public.find_branch_by_chat_id(_organization_id uuid, _chat_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id 
  FROM public.branches 
  WHERE organization_id = _organization_id 
    AND whatsapp_chat_id = _chat_id
    AND is_deleted = false
    AND is_active = true
  LIMIT 1;
$$;
