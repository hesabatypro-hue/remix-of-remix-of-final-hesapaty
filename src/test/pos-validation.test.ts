import { describe, it, expect } from "vitest";
import {
  isFiniteNonNegative,
  validateInvoiceArithmetic,
  AMOUNT_TOLERANCE,
  type QueuedInvoice,
} from "../../supabase/functions/_shared/pos-validation";

function invoice(overrides: Partial<QueuedInvoice> = {}): QueuedInvoice {
  return {
    client_local_id: "local-1",
    branch_id: "11111111-1111-1111-1111-111111111111",
    organization_id: "22222222-2222-2222-2222-222222222222",
    total_amount: 300,
    payment_method: "cash",
    invoice_number: "POS-001",
    created_at_local: "2026-08-06T10:00:00.000Z",
    items: [
      { product_id: null, product_name: "شاي", quantity: 2, unit_price: 100, subtotal: 200 },
      { product_id: null, product_name: "سكر", quantity: 1, unit_price: 100, subtotal: 100 },
    ],
    ...overrides,
  };
}

describe("numeric guard", () => {
  it("accepts finite non-negative numbers only", () => {
    expect(isFiniteNonNegative(0)).toBe(true);
    expect(isFiniteNonNegative(12.5)).toBe(true);
    expect(isFiniteNonNegative(-1)).toBe(false);
    expect(isFiniteNonNegative(NaN)).toBe(false);
    expect(isFiniteNonNegative(Infinity)).toBe(false);
    expect(isFiniteNonNegative("10")).toBe(false);
    expect(isFiniteNonNegative(null)).toBe(false);
  });
});

describe("offline POS invoice arithmetic", () => {
  it("accepts a self-consistent invoice", () => {
    expect(validateInvoiceArithmetic(invoice())).toBe(null);
  });

  it("allows a discounted unit price as long as the maths add up", () => {
    const q = invoice({
      total_amount: 150,
      items: [{ product_id: null, product_name: "شاي", quantity: 2, unit_price: 75, subtotal: 150 }],
    });
    expect(validateInvoiceArithmetic(q)).toBe(null);
  });

  it("tolerates sub-cent float drift", () => {
    const q = invoice({
      total_amount: 300 + AMOUNT_TOLERANCE / 2,
    });
    expect(validateInvoiceArithmetic(q)).toBe(null);
  });

  it("rejects a tampered grand total", () => {
    expect(validateInvoiceArithmetic(invoice({ total_amount: 1 }))).toBe("total_amount_mismatch");
  });

  it("rejects a tampered line subtotal", () => {
    const q = invoice({
      items: [{ product_id: null, product_name: "شاي", quantity: 2, unit_price: 100, subtotal: 1 }],
      total_amount: 1,
    });
    expect(validateInvoiceArithmetic(q)).toBe("item_subtotal_mismatch");
  });

  it("rejects invalid totals, empty carts and bad line values", () => {
    expect(validateInvoiceArithmetic(invoice({ total_amount: -5 }))).toBe("invalid_total_amount");
    expect(validateInvoiceArithmetic(invoice({ items: [] }))).toBe("missing_items");
    expect(validateInvoiceArithmetic(invoice({ items: undefined as never }))).toBe("missing_items");
    expect(
      validateInvoiceArithmetic(
        invoice({ items: [{ product_id: null, product_name: "x", quantity: 0, unit_price: 1, subtotal: 0 }] }),
      ),
    ).toBe("invalid_item_quantity");
    expect(
      validateInvoiceArithmetic(
        invoice({ items: [{ product_id: null, product_name: "x", quantity: 1, unit_price: -1, subtotal: 0 }] }),
      ),
    ).toBe("invalid_item_unit_price");
    expect(
      validateInvoiceArithmetic(
        invoice({
          items: [{ product_id: null, product_name: "x", quantity: 1, unit_price: 1, subtotal: NaN }],
        }),
      ),
    ).toBe("invalid_item_subtotal");
  });
});
