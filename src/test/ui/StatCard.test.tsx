import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Banknote } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="إيرادات اليوم" value="1,200 ج.س" icon={Banknote} />);
    expect(screen.getByText("إيرادات اليوم")).toBeInTheDocument();
    expect(screen.getByText("1,200 ج.س")).toBeInTheDocument();
  });

  it("omits the change line when not provided", () => {
    const { container } = render(<StatCard title="فروع" value="3" icon={Banknote} />);
    expect(container.textContent).not.toContain("↑");
    expect(container.textContent).not.toContain("↓");
  });

  it("shows an up arrow for positive change", () => {
    render(
      <StatCard title="إيرادات" value="10" change="5 تحويل" changeType="positive" icon={Banknote} />
    );
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/5 تحويل/)).toBeInTheDocument();
  });

  it("shows a down arrow for negative change", () => {
    render(
      <StatCard title="مصروفات" value="10" change="زيادة" changeType="negative" icon={Banknote} />
    );
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it("applies the requested icon color variant", () => {
    const { container } = render(
      <StatCard title="t" value="v" icon={Banknote} iconColor="destructive" />
    );
    expect(container.querySelector(".bg-destructive")).toBeTruthy();
  });
});
