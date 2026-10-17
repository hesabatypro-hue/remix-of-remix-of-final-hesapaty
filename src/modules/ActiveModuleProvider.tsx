import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { MODULES, getEnabledModules } from "./registry";
import type { ModuleDefinition, ModuleKey } from "./types";

interface Ctx {
  activeModule: ModuleDefinition;
  availableModules: ModuleDefinition[];
  switchModule: (key: ModuleKey) => void;
}

const ActiveModuleContext = createContext<Ctx | undefined>(undefined);

const storageKey = (orgId?: string | null) => `activeModule:${orgId ?? "_"}`;

export function ActiveModuleProvider({ children }: { children: ReactNode }) {
  const { currentOrganization } = useAuth();
  const qc = useQueryClient();

  const available = useMemo(
    () => getEnabledModules(currentOrganization ?? undefined),
    [currentOrganization],
  );

  const [manualKey, setManualKey] = useState<ModuleKey | null>(() => {
    const orgId = currentOrganization?.id;
    if (!orgId) return null;
    const saved = localStorage.getItem(storageKey(orgId));
    return (saved as ModuleKey) || null;
  });

  // Re-hydrate when the organization changes
  useEffect(() => {
    const saved = localStorage.getItem(storageKey(currentOrganization?.id));
    setManualKey((saved as ModuleKey) || null);
  }, [currentOrganization?.id]);

  const activeModule = useMemo<ModuleDefinition>(() => {
    // Prefer manual pick if still available
    if (manualKey) {
      const m = available.find((x) => x.key === manualKey);
      if (m) return m;
    }
    return available[0] ?? MODULES[0];
  }, [available, manualKey]);

  // Clean up stale localStorage if module got disabled
  useEffect(() => {
    if (manualKey && !available.some((m) => m.key === manualKey)) {
      localStorage.removeItem(storageKey(currentOrganization?.id));
      setManualKey(null);
    }
  }, [available, manualKey, currentOrganization?.id]);

  const switchModule = useCallback(
    (key: ModuleKey) => {
      const orgId = currentOrganization?.id;
      if (!orgId) return;
      localStorage.setItem(storageKey(orgId), key);
      setManualKey(key);
      // Clear cached data across modules to prevent leakage
      qc.clear();
    },
    [currentOrganization?.id, qc],
  );

  const value = useMemo(
    () => ({ activeModule, availableModules: available, switchModule }),
    [activeModule, available, switchModule],
  );

  return <ActiveModuleContext.Provider value={value}>{children}</ActiveModuleContext.Provider>;
}

export function useActiveModule(): Ctx {
  const ctx = useContext(ActiveModuleContext);
  if (!ctx) throw new Error("useActiveModule must be used within ActiveModuleProvider");
  return ctx;
}
