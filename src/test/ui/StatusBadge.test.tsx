import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, getTransferStatus } from "@/components/transfers/StatusBadge";

const base = {
  id: "1",
  amount: 100,
  is_confirmed: false,
  needs_review: false,
  client_memo: "دفعة زبون",
  transfer_date: "2026-01-01",
  created_at: "2026-01-01T10:00:00Z",
} as any;

describe("getTransferStatus", () => {
  it("returns confirmed for confirmed transfers", () => {
    expect(getTransferStatus({ ...base, is_confirmed: true })).toBe("confirmed");
  });

  it("returns pending when memo is missing", () => {
    expect(getTransferStatus({ ...base, client_memo: "" })).toBe("pending");
    expect(getTransferStatus({ ...base, client_memo: null })).toBe("pending");
  });

  it("returns pending when review is required", () => {
    expect(getTransferStatus({ ...base, needs_review: true })).toBe("pending");
  });

  it("returns unconfirmed for failed transfers", () => {
    expect(getTransferStatus({ ...base, status: "failed" })).toBe("unconfirmed");
  });

  it("falls back to needs_action", () => {
    expect(getTransferStatus(base)).toBe("needs_action");
  });
});

describe("StatusBadge", () => {
  it("renders the Arabic label for confirmed", () => {
    render(<StatusBadge transfer={{ ...base, is_confirmed: true }} />);
    expect(screen.getByText("مؤكد")).toBeInTheDocument();
  });

  it("renders the pending label with rtl direction", () => {
    const { container } = render(<StatusBadge transfer={{ ...base, client_memo: "" }} />);
    expect(screen.getByText("بانتظار البيان")).toBeInTheDocument();
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
  });

  it("renders the failed label", () => {
    render(<StatusBadge transfer={{ ...base, status: "failed" }} />);
    expect(screen.getByText("غير مؤكد")).toBeInTheDocument();
  });
});
