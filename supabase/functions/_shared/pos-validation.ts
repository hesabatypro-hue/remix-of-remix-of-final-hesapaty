/** Pure arithmetic validation for offline POS invoices pushed by clients. */

export interface QueuedInvoiceItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface QueuedInvoice {
  client_local_id: string;
  branch_id: string;
  organization_id: string;
  total_amount: number;
  payment_method: "cash" | "bank_transfer" | "card";
  invoice_number: string;
  created_at_local: string;
  notes?: string;
  items: QueuedInvoiceItem[];
}

/**
 * Tolerance for floating-point rounding when comparing computed vs. reported
 * monetary totals (not a business discount allowance — unit_price itself is
 * still fully client-controlled, so legitimate per-sale discounts remain
 * possible; this only catches numbers that don't internally add up).
 */
export const AMOUNT_TOLERANCE = 0.01;

export function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Validates that the invoice's reported totals are internally consistent with
 * its own line items. Returns an error code, or null when the invoice is sane.
 */
export function validateInvoiceArithmetic(q: QueuedInvoice): string | null {
  if (!isFiniteNonNegative(q.total_amount)) return "invalid_total_amount";
  if (!Array.isArray(q.items) || q.items.length === 0) return "missing_items";

  let computedTotal = 0;
  for (const it of q.items) {
    if (!isFiniteNonNegative(it.quantity) || it.quantity <= 0) return "invalid_item_quantity";
    if (!isFiniteNonNegative(it.unit_price)) return "invalid_item_unit_price";
    if (!isFiniteNonNegative(it.subtotal)) return "invalid_item_subtotal";

    const expectedSubtotal = it.quantity * it.unit_price;
    if (Math.abs(expectedSubtotal - it.subtotal) > AMOUNT_TOLERANCE) {
      return "item_subtotal_mismatch";
    }
    computedTotal += it.subtotal;
  }

  if (Math.abs(computedTotal - q.total_amount) > AMOUNT_TOLERANCE) {
    return "total_amount_mismatch";
  }

  return null;
}
