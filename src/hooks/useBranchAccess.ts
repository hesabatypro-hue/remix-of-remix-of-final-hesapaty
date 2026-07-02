import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook to determine user's branch access level.
 * - Owner/Admin: full access (null branch_id)
 * - Manager/Viewer with branch_id: restricted to that branch
 * - Manager/Viewer without branch_id: full access
 */
export function useBranchAccess() {
  const { currentRole } = useAuth();

  const hasFullAccess = !currentRole?.branch_id || 
    currentRole.role === "owner" || 
    currentRole.role === "admin";

  const restrictedBranchId = hasFullAccess ? null : currentRole?.branch_id || null;

  return {
    hasFullAccess,
    restrictedBranchId,
    userRole: currentRole?.role || null,
  };
}
