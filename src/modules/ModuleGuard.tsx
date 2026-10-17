import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useActiveModule } from "./ActiveModuleProvider";
import { MODULES } from "./registry";
import { SHARED_PATHS } from "./types";

/**
 * Enforces module isolation: blocks navigation to routes owned by
 * modules that are not currently active. Shared routes always pass.
 */
export function ModuleGuard({ children }: { children: ReactNode }) {
  const { activeModule } = useActiveModule();
  const { pathname } = useLocation();

  // Shared paths always allowed
  if (SHARED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  // Route belongs to active module → allow
  if (activeModule.ownedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  // Route belongs to some other module → check if that other module is inactive
  const ownedByOther = MODULES.some(
    (m) => m.key !== activeModule.key && m.ownedPaths.some((p) => pathname === p || pathname.startsWith(p + "/")),
  );
  if (ownedByOther) {
    return <Navigate to={activeModule.rootPath} replace />;
  }

  // Unknown path — let route table handle 404
  return <>{children}</>;
}
