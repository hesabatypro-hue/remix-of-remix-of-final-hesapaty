import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns true when the current organization has POS enabled.
 * Used to switch UI between the classic revenue tracker and POS mode.
 */
export function usePOSMode() {
  const { currentOrganization, userRoles } = useAuth();
  const isPOSEnabled = Boolean((currentOrganization as any)?.is_pos_enabled);
  const currentRole = userRoles.find(
    (r) => r.organization_id === currentOrganization?.id,
  )?.role as string | undefined;
  const isCashier = currentRole === "cashier";

  return {
    isPOSEnabled,
    isCashier,
    currentRole,
  };
}
