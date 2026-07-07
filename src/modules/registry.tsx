import { lazy } from "react";
import {
  LayoutDashboard,
  Receipt,
  Store,
  BarChart3,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  Activity,
  FileText,
  Wallet,
  UserCog,
  Banknote,
  Printer,
  TrendingUp,
  FileSpreadsheet,
  ShoppingCart,
  Package,
  Boxes,
  Building2,
  Users,
  Settings,
  CreditCard,
} from "lucide-react";
import type { ModuleDefinition, NavItem } from "./types";

const RevenueDashboard = lazy(() => import("./revenue/dashboard/RevenueDashboard"));
const POSDashboard = lazy(() => import("./pos/dashboard/POSDashboard"));

/** Shared nav items appended to every module's sidebar. */
export const SHARED_NAV_ITEMS: NavItem[] = [
  { path: "/users", label: "المستخدمين", icon: Users },
  { path: "/subscription-invoices", label: "فواتير الاشتراك", icon: CreditCard },
  { path: "/organization", label: "المؤسسة", icon: Building2 },
  { path: "/settings", label: "الإعدادات", icon: Settings },
];

// ─────────────────────── Revenue Tracker ───────────────────────
const revenueNavItems: NavItem[] = [
  { path: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, bottom: true },
  { path: "/transfers", label: "التحويلات", icon: Receipt, bottom: true },
  { path: "/branches", label: "الفروع", icon: Store, bottom: true },
  { path: "/statistics", label: "الإحصائيات", icon: BarChart3, bottom: true },
  { path: "/review", label: "المراجعة البشرية", icon: ShieldAlert },
  { path: "/expenses", label: "المصروفات", icon: Wallet },
  { path: "/employees", label: "الموظفين", icon: UserCog },
  { path: "/salaries", label: "الرواتب", icon: Banknote },
  { path: "/reports", label: "تقارير الإيرادات", icon: FileText },
  { path: "/financial-reports", label: "التقارير المالية", icon: FileText },
  { path: "/whatsapp", label: "واتساب", icon: MessageCircle },
  { path: "/whatsapp-logs", label: "سجل الرسائل", icon: ScrollText },
  { path: "/processing", label: "مراقبة المعالجة", icon: Activity },
  { path: "/print-orders", label: "أوامر التشغيل", icon: Printer },
  { path: "/investments", label: "الاستثمار والائتمان", icon: TrendingUp },
  { path: "/invoices", label: "الفواتير", icon: FileSpreadsheet },
];

// ─────────────────────── POS & Inventory ───────────────────────
const posNavItems: NavItem[] = [
  { path: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard, bottom: true },
  { path: "/pos", label: "نقطة البيع", icon: ShoppingCart, bottom: true },
  { path: "/products", label: "المنتجات", icon: Package, bottom: true },
  { path: "/inventory", label: "المخزون", icon: Boxes, bottom: true },
  { path: "/branches", label: "الفروع", icon: Store },
  { path: "/employees", label: "الموظفين", icon: UserCog },
  { path: "/expenses", label: "المصروفات", icon: Wallet },
  { path: "/salaries", label: "الرواتب", icon: Banknote },
  { path: "/financial-reports", label: "التقارير المالية", icon: FileText },
];

export const MODULES: ModuleDefinition[] = [
  {
    key: "REVENUE_TRACKER",
    label: "متعقّب الإيرادات",
    tagline: "التحويلات البنكية والمراجعة عبر واتساب",
    icon: Receipt,
    rootPath: "/dashboard",
    priority: 10,
    // Always enabled — default module
    isEnabled: () => true,
    ownedPaths: [
      "/transfers",
      "/review",
      "/reports",
      "/whatsapp",
      "/whatsapp-logs",
      "/whatsapp-confirmation-log",
      "/processing",
      "/statistics",
      "/invoices",
      "/investments",
      "/print-orders",
      "/financial-reports",
      "/expenses",
      "/employees",
      "/salaries",
    ],
    navItems: revenueNavItems,
    Dashboard: RevenueDashboard,
  },
  {
    key: "POS_INVENTORY",
    label: "نقطة البيع والمخزون",
    tagline: "الكاشير، المنتجات، والمخزون متعدد الفروع",
    icon: ShoppingCart,
    rootPath: "/dashboard",
    priority: 20,
    isEnabled: (org) => Boolean(org?.is_pos_enabled),
    ownedPaths: ["/pos", "/products", "/inventory", "/financial-reports", "/expenses", "/employees", "/salaries"],
    navItems: posNavItems,
    Dashboard: POSDashboard,
  },
];

export function getEnabledModules(org: Parameters<ModuleDefinition["isEnabled"]>[0]) {
  return MODULES.filter((m) => m.isEnabled(org)).sort((a, b) => b.priority - a.priority);
}
