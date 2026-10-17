import { useAuth } from "@/contexts/AuthContext";
import { useActiveModule } from "@/modules/ActiveModuleProvider";

/**
 * Legacy hook kept for backward compatibility.
 * Prefer useActiveModule() for new code.
 */
export function usePOSMode() {
  const { currentOrganization, userRoles } = useAuth();
  const { activeModule } = useActiveModule();
  const isPOSEnabled = activeModule.key === "POS_INVENTORY";
  const currentRole = userRoles.find(
    (r) => r.organization_id === currentOrganization?.id,
  )?.role as string | undefined;
  const isCashier = currentRole === "cashier";
  return { isPOSEnabled, isCashier, currentRole };
}
