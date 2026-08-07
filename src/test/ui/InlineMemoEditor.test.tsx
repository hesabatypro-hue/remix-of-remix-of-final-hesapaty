import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineMemoEditor } from "@/components/transfers/InlineMemoEditor";

describe("InlineMemoEditor", () => {
  it("shows a placeholder when there is no value", () => {
    render(<InlineMemoEditor value={null} onSave={() => {}} />);
    expect(screen.getByText("⏳ بانتظار البيان...")).toBeInTheDocument();
  });

  it("enters edit mode on click and saves a changed value", () => {
    const onSave = vi.fn();
    render(<InlineMemoEditor value="قديم" onSave={onSave} />);
    fireEvent.click(screen.getByText("قديم"));
    const input = screen.getByPlaceholderText("اكتب تفاصيل الطلب...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "جديد" } });
    fireEvent.click(screen.getByTitle("حفظ"));
    expect(onSave).toHaveBeenCalledWith("جديد");
  });

  it("does not save when the value is unchanged", () => {
    const onSave = vi.fn();
    render(<InlineMemoEditor value="نفس" onSave={onSave} />);
    fireEvent.click(screen.getByText("نفس"));
    fireEvent.keyDown(screen.getByPlaceholderText("اكتب تفاصيل الطلب..."), { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("cancels edits with Escape", () => {
    const onSave = vi.fn();
    render(<InlineMemoEditor value="أصلي" onSave={onSave} />);
    fireEvent.click(screen.getByText("أصلي"));
    const input = screen.getByPlaceholderText("اكتب تفاصيل الطلب...");
    fireEvent.change(input, { target: { value: "ملغى" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("أصلي")).toBeInTheDocument();
  });

  it("saves via Enter", () => {
    const onSave = vi.fn();
    render(<InlineMemoEditor value="" onSave={onSave} />);
    fireEvent.click(screen.getByText("⏳ بانتظار البيان..."));
    const input = screen.getByPlaceholderText("اكتب تفاصيل الطلب...");
    fireEvent.change(input, { target: { value: "  دفعة  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("دفعة");
  });

  it("renders the original OCR text alongside the edited memo", () => {
    render(<InlineMemoEditor value="معدل" originalValue="نص أصلي" onSave={() => {}} />);
    expect(screen.getByText("نص أصلي")).toBeInTheDocument();
  });

  it("shows an error indicator when saving failed", () => {
    render(<InlineMemoEditor value="x" onSave={() => {}} isError />);
    expect(screen.getByTitle("فشل الحفظ — اضغط للمحاولة مجدداً")).toBeInTheDocument();
  });

  it("shows a spinner while pending", () => {
    render(<InlineMemoEditor value="x" onSave={() => {}} isPending />);
    expect(screen.getByTitle("جاري الحفظ...")).toBeInTheDocument();
  });
});
