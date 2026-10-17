import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Store,
  TrendingUp,
  TrendingDown,
  Receipt,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, parse } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";

type ReportPeriod = "today" | "week" | "month" | "last_month" | "custom";

export default function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("month");
  const [customMonth, setCustomMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const { currentOrganization } = useAuth();

  const getDateRange = (p: ReportPeriod) => {
    const now = new Date();
    switch (p) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 6 }), end: endOfWeek(now, { weekStartsOn: 6 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_month": {
        const lm = subMonths(now, 1);
        return { start: startOfMonth(lm), end: endOfMonth(lm) };
      }
      case "custom": {
        const d = customMonth ? parse(customMonth, "yyyy-MM", new Date()) : now;
        return { start: startOfMonth(d), end: endOfMonth(d) };
      }
    }
  };

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["report", currentOrganization?.id, period, customMonth],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;

      const { start, end } = getDateRange(period);

      // Get transfers for the period
      const { data: transfers, error: transfersError } = await supabase
        .from("transfers")
        .select(`
          *,
          branches (id, name)
        `)
        .eq("organization_id", currentOrganization.id)
        .gte("transfer_date", format(start, "yyyy-MM-dd"))
        .lte("transfer_date", format(end, "yyyy-MM-dd"));

      if (transfersError) throw transfersError;

      // Aggregate by branch
      const branchMap = new Map<string, { name: string; revenue: number; transfers: number }>();
      
      (transfers || []).forEach((t) => {
        const branchId = t.branch_id;
        const branchName = t.branches?.name || "غير محدد";
        
        if (!branchMap.has(branchId)) {
          branchMap.set(branchId, { name: branchName, revenue: 0, transfers: 0 });
        }
        
        const branch = branchMap.get(branchId)!;
        if (t.is_confirmed) {
          branch.revenue += Number(t.amount);
        }
        branch.transfers += 1;
      });

      const branches = Array.from(branchMap.values()).sort((a, b) => b.revenue - a.revenue);
      
      const totalRevenue = branches.reduce((sum, b) => sum + b.revenue, 0);
      const totalTransfers = transfers?.length || 0;
      const confirmedTransfers = transfers?.filter(t => t.is_confirmed).length || 0;
      const pendingTransfers = transfers?.filter(t => !t.is_confirmed).length || 0;

      return {
        totalRevenue,
        totalTransfers,
        confirmedTransfers,
        pendingTransfers,
        branches,
        dateRange: { start, end },
      };
    },
    enabled: !!currentOrganization?.id,
  });

  const handlePrint = () => {
    window.print();
  };

  const periodLabels: Record<ReportPeriod, string> = {
    today: "اليوم",
    week: "هذا الأسبوع",
    month: "هذا الشهر",
    last_month: "الشهر الماضي",
    custom: "شهر محدد",
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 no-print">
        <div>
          <h1 className="text-3xl font-bold text-foreground">التقارير</h1>
          <p className="text-muted-foreground mt-1">
            تقارير الإيرادات والتحويلات
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 ml-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="week">هذا الأسبوع</SelectItem>
              <SelectItem value="month">هذا الشهر</SelectItem>
              <SelectItem value="last_month">الشهر الماضي</SelectItem>
              <SelectItem value="custom">شهر محدد</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <Input
              type="month"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
              className="w-[160px]"
            />
          )}
          <Button
            variant="outline"
            className="gap-2"
            disabled={!reportData}
            onClick={async () => {
              if (!reportData) return;
              const { exportToPDF } = await import("@/utils/exportUtils");
              const dateRangeText = reportData.dateRange
                ? `${format(reportData.dateRange.start, "d MMMM yyyy", { locale: ar })}${period !== "today" ? ` - ${format(reportData.dateRange.end, "d MMMM yyyy", { locale: ar })}` : ""}`
                : "";
              exportToPDF({
                organizationName: currentOrganization?.name || "",
                periodLabel: periodLabels[period],
                dateRangeText,
                totalRevenue: reportData.totalRevenue,
                totalTransfers: reportData.totalTransfers,
                confirmedTransfers: reportData.confirmedTransfers,
                pendingTransfers: reportData.pendingTransfers,
                branches: reportData.branches,
              });
            }}
          >
            <Download className="w-4 h-4" />
            تصدير PDF
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={!reportData}
            onClick={async () => {
              if (!reportData) return;
              const { exportToExcel } = await import("@/utils/exportUtils");
              const dateRangeText = reportData.dateRange
                ? `${format(reportData.dateRange.start, "d MMMM yyyy", { locale: ar })}${period !== "today" ? ` - ${format(reportData.dateRange.end, "d MMMM yyyy", { locale: ar })}` : ""}`
                : "";
              exportToExcel({
                organizationName: currentOrganization?.name || "",
                periodLabel: periodLabels[period],
                dateRangeText,
                totalRevenue: reportData.totalRevenue,
                totalTransfers: reportData.totalTransfers,
                confirmedTransfers: reportData.confirmedTransfers,
                pendingTransfers: reportData.pendingTransfers,
                branches: reportData.branches,
              });
            }}
          >
            <FileText className="w-4 h-4" />
            تصدير Excel
          </Button>
          <Button className="gap-2" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !reportData ? (
        <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">لا توجد بيانات لعرضها</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-4 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <img src={logo} alt="حساباتي" className="w-16 h-16 rounded-2xl" />
                <div>
                  <h2 className="text-2xl font-bold text-foreground">
                    تقرير {periodLabels[period]}
                  </h2>
                  <p className="text-muted-foreground">
                    {reportData.dateRange && (
                      <>
                        {format(reportData.dateRange.start, "d MMMM yyyy", { locale: ar })}
                        {period !== "today" && (
                          <> - {format(reportData.dateRange.end, "d MMMM yyyy", { locale: ar })}</>
                        )}
                      </>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentOrganization?.name}
                  </p>
                </div>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                <p className="text-2xl sm:text-4xl font-bold text-primary">
                  {reportData.totalRevenue.toLocaleString()} ج.س
                </p>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Receipt className="w-4 h-4" />
                  <span className="text-sm">إجمالي التحويلات</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {reportData.totalTransfers}
                </p>
              </div>
              <div className="bg-success/10 rounded-xl p-4">
                <div className="flex items-center gap-2 text-success mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">تحويلات مؤكدة</span>
                </div>
                <p className="text-2xl font-bold text-success">
                  {reportData.confirmedTransfers}
                </p>
              </div>
              <div className="bg-warning/10 rounded-xl p-4">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <Store className="w-4 h-4" />
                  <span className="text-sm">قيد المراجعة</span>
                </div>
                <p className="text-2xl font-bold text-warning">
                  {reportData.pendingTransfers}
                </p>
              </div>
              <div className="bg-primary/10 rounded-xl p-4">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Store className="w-4 h-4" />
                  <span className="text-sm">عدد الفروع</span>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {reportData.branches.length}
                </p>
              </div>
            </div>
          </div>

          {/* Branch Details */}
          {reportData.branches.length > 0 ? (
            <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-xl font-bold text-foreground">
                  تفاصيل الفروع
                </h3>
                <p className="text-sm text-muted-foreground">
                  إيرادات كل فرع خلال الفترة المحددة
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-right p-4 font-medium text-muted-foreground">
                        #
                      </th>
                      <th className="text-right p-4 font-medium text-muted-foreground">
                        الفرع
                      </th>
                      <th className="text-right p-4 font-medium text-muted-foreground">
                        عدد التحويلات
                      </th>
                      <th className="text-right p-4 font-medium text-muted-foreground">
                        الإيرادات
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.branches.map((branch, index) => (
                      <tr
                        key={index}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 text-muted-foreground">{index + 1}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                              <Store className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <span className="font-medium text-foreground">
                              {branch.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-1 bg-muted rounded-full text-sm">
                            {branch.transfers} تحويل
                          </span>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-foreground">
                            {branch.revenue.toLocaleString()} ج.س
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-primary/5 border-t-2 border-primary">
                      <td colSpan={2} className="p-4 font-bold text-foreground">
                        الإجمالي
                      </td>
                      <td className="p-4 font-bold text-foreground">
                        {reportData.totalTransfers} تحويل
                      </td>
                      <td className="p-4 font-bold text-primary text-lg">
                        {reportData.totalRevenue.toLocaleString()} ج.س
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-12 text-center">
              <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">لا توجد تحويلات خلال هذه الفترة</p>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}