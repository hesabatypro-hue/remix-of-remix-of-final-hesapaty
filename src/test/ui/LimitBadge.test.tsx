import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LimitBadge } from "@/components/limits/LimitBadge";
import { PrintOrderStatusBadge } from "@/components/print-orders/PrintOrderStatusBadge";

describe("LimitBadge", () => {
  it("renders current/max with the label", () => {
    render(<LimitBadge current={2} max={5} label="الفروع" />);
    expect(screen.getByText("الفروع: 2/5")).toBeInTheDocument();
  });

  it("uses the muted style well below the limit", () => {
    const { container } = render(<LimitBadge current={1} max={10} label="x" />);
    expect(container.querySelector(".bg-muted")).toBeTruthy();
  });

  it("warns when near the limit", () => {
    const { container } = render(<LimitBadge current={8} max={10} label="x" />);
    expect(container.querySelector(".bg-warning\\/10")).toBeTruthy();
  });

  it("marks the destructive state at the limit", () => {
    const { container } = render(<LimitBadge current={10} max={10} label="x" />);
    expect(container.querySelector(".bg-destructive\\/10")).toBeTruthy();
  });
});

describe("PrintOrderStatusBadge", () => {
  it.each([
    ["draft", "مسودة"],
    ["approved", "معتمد"],
    ["printing", "قيد الطباعة"],
    ["printed", "مطبوع"],
    ["delivered", "مسلّم"],
    ["cancelled", "ملغي"],
  ])("maps %s to its Arabic label", (status, label) => {
    render(<PrintOrderStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("falls back to the raw status when unknown", () => {
    render(<PrintOrderStatusBadge status="weird" />);
    expect(screen.getByText("weird")).toBeInTheDocument();
  });
});
