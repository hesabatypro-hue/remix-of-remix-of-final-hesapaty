import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrganizationLimits {
  max_branches: number;
  current_branches: number;
  max_users: number;
  current_users: number;
  plan_type: string;
}

export const useOrganizationLimits = () => {
  const { currentOrganization } = useAuth();

  const { data: limits, isLoading, error, refetch } = useQuery({
    queryKey: ['organization-limits', currentOrganization?.id],
    queryFn: async (): Promise<OrganizationLimits | null> => {
      if (!currentOrganization?.id) return null;
      
      const { data, error } = await supabase
        .rpc('get_organization_limits', { _organization_id: currentOrganization.id });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        return {
          max_branches: data[0].max_branches,
          current_branches: Number(data[0].current_branches),
          max_users: data[0].max_users,
          current_users: Number(data[0].current_users),
          plan_type: data[0].plan_type,
        };
      }
      
      return null;
    },
    enabled: !!currentOrganization?.id,
  });

  const canAddBranch = limits ? limits.current_branches < limits.max_branches : false;
  const canAddUser = limits ? limits.current_users < limits.max_users : false;
  
  const branchesRemaining = limits ? limits.max_branches - limits.current_branches : 0;
  const usersRemaining = limits ? limits.max_users - limits.current_users : 0;

  return {
    limits,
    isLoading,
    error,
    refetch,
    canAddBranch,
    canAddUser,
    branchesRemaining,
    usersRemaining,
  };
};
