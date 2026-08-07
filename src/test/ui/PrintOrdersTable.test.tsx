import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrintOrdersTable } from "@/components/print-orders/PrintOrdersTable";

const order = {
  id: "o1",
  customer_name: "أحمد",
  material_type: "فينيل",
  total_area: 4.5,
  total_price: 900,
  status: "draft",
  created_at: "2026-01-05T09:00:00Z",
} as any;

describe("PrintOrdersTable", () => {
  it("renders an empty state", () => {
    render(<PrintOrdersTable orders={[]} onStatusChange={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/لا توجد أوامر تشغيل بعد/)).toBeInTheDocument();
  });

  it("renders order rows with formatted area and price", () => {
    render(<PrintOrdersTable orders={[order]} onStatusChange={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("أحمد")).toBeInTheDocument();
    expect(screen.getByText("4.50 م²")).toBeInTheDocument();
    expect(screen.getByText("900.00 ر.س")).toBeInTheDocument();
    expect(screen.getByText("مسودة")).toBeInTheDocument();
  });

  it("offers the next statuses in the flow and triggers a change", () => {
    const onStatusChange = vi.fn();
    render(<PrintOrdersTable orders={[order]} onStatusChange={onStatusChange} onDelete={() => {}} />);
    fireEvent.pointerDown(
      screen.getByRole("button"),
      new MouseEvent("pointerdown", { bubbles: true }) as any
    );
    fireEvent.click(screen.getByText(/تغيير إلى: معتمد/));
    expect(onStatusChange).toHaveBeenCalledWith("o1", "approved");
  });

  it("asks for confirmation before deleting", () => {
    const onDelete = vi.fn();
    render(<PrintOrdersTable orders={[order]} onStatusChange={() => {}} onDelete={onDelete} />);
    fireEvent.pointerDown(
      screen.getByRole("button"),
      new MouseEvent("pointerdown", { bubbles: true }) as any
    );
    fireEvent.click(screen.getByText("حذف"));
    expect(screen.getByText("تأكيد الحذف")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("حذف").pop()!);
    expect(onDelete).toHaveBeenCalledWith("o1");
  });
});
