GRANT EXECUTE ON FUNCTION public.get_user_organization_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_branch_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid, uuid, app_role[]) TO authenticated;