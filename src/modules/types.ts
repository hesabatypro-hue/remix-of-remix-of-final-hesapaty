import type { LucideIcon } from "lucide-react";
import type { LazyExoticComponent, ComponentType } from "react";

export type ModuleKey = "REVENUE_TRACKER" | "POS_INVENTORY";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Show in mobile bottom nav (first 4 win). */
  bottom?: boolean;
}

export interface OrgLike {
  industry_type?: string | null;
  investment_enabled?: boolean | null;
  invoicing_enabled?: boolean | null;
  is_pos_enabled?: boolean | null;
}

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Route the module considers its home ("/dashboard" by default). */
  rootPath: string;
  /** Higher priority wins when multiple modules are enabled. */
  priority: number;
  /** Returns true if this module is activatable for the given organization. */
  isEnabled: (org: OrgLike | null | undefined) => boolean;
  /** Paths that belong to this module (guarded — inactive modules redirect). */
  ownedPaths: string[];
  /** Sidebar / bottom nav items for the module. */
  navItems: NavItem[];
  /** Dashboard component rendered at /dashboard when this module is active. */
  Dashboard: LazyExoticComponent<ComponentType<unknown>>;
}

/** Paths that are always allowed regardless of the active module. */
export const SHARED_PATHS: string[] = [
  "/dashboard",
  "/organization",
  "/settings",
  "/users",
  "/branches",
  "/subscription-invoices",
  "/select-organization",
  "/onboarding",
];
