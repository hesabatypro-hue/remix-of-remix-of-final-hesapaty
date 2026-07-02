import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, Building2 } from "lucide-react";

export type TimePeriod = "today" | "week" | "month" | "last_month" | "custom" | "all";

interface Branch {
  id: string;
  name: string;
}

interface DashboardFiltersProps {
  timePeriod: TimePeriod;
  onTimePeriodChange?: (period: TimePeriod) => void;
  selectedBranch: string;
  onBranchChange: (branchId: string) => void;
  branches: Branch[];
  hideTimePeriod?: boolean;
  customMonth?: string; // YYYY-MM
  onCustomMonthChange?: (month: string) => void;
  showAllOption?: boolean;
}

export const timePeriodLabels: Record<TimePeriod, string> = {
  today: "اليوم",
  week: "هذا الأسبوع",
  month: "هذا الشهر",
  last_month: "الشهر الماضي",
  custom: "اختر شهر",
  all: "الكل",
};

export function DashboardFilters({
  timePeriod,
  onTimePeriodChange,
  selectedBranch,
  onBranchChange,
  branches,
  hideTimePeriod = false,
  customMonth,
  onCustomMonthChange,
  showAllOption = true,
}: DashboardFiltersProps) {
  const periodOrder: TimePeriod[] = showAllOption
    ? ["today", "week", "month", "last_month", "custom", "all"]
    : ["today", "week", "month", "last_month", "custom"];

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {!hideTimePeriod && onTimePeriodChange && (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={timePeriod} onValueChange={(v) => onTimePeriodChange(v as TimePeriod)}>
            <SelectTrigger className="w-[150px] bg-card border-border">
              <SelectValue placeholder="اختر الفترة" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {periodOrder.map((value) => (
                <SelectItem key={value} value={value}>
                  {timePeriodLabels[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timePeriod === "custom" && (
            <Input
              type="month"
              value={customMonth || ""}
              onChange={(e) => onCustomMonthChange?.(e.target.value)}
              className="w-[160px] bg-card border-border"
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <Select value={selectedBranch} onValueChange={onBranchChange}>
          <SelectTrigger className="w-[160px] bg-card border-border">
            <SelectValue placeholder="اختر الفرع" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border z-50">
            <SelectItem value="all">جميع الفروع</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
