import { ArrowLeftRight, ShoppingCart, Wallet, FileSpreadsheet, Banknote, type LucideIcon } from "lucide-react";

export type ReconciliationSource = "transfer" | "pos_invoice" | "expense" | "invoice" | "salary";

export interface SourceMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Page where the user can review the underlying records. */
  path: string;
}

/** Single source of truth for how each ledger source is presented. */
export const SOURCE_META: Record<ReconciliationSource, SourceMeta> = {
  transfer: { label: "التحويلات المؤكدة", description: "تحويلات بنكية مؤكدة", icon: ArrowLeftRight, path: "/transfers" },
  pos_invoice: { label: "مبيعات نقطة البيع", description: "فواتير مؤكدة غير مرتبطة بتحويل", icon: ShoppingCart, path: "/pos" },
  expense: { label: "المصروفات المعتمدة", description: "مصروفات بحالة معتمد", icon: Wallet, path: "/expenses" },
  invoice: { label: "الفواتير المدفوعة", description: "فواتير العملاء المدفوعة", icon: FileSpreadsheet, path: "/invoices" },
  salary: { label: "الرواتب المصروفة", description: "دفعات رواتب مكتملة", icon: Banknote, path: "/salaries" },
};

export const RECONCILIATION_ROLES = ["owner", "admin"] as const;

export const formatSDG = (n: number) => `${n.toLocaleString("ar-SD")} ج.س`;
