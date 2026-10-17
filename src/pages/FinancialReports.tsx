import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useFinancialStats, MonthlyFinancial } from "@/hooks/useFinancialStats";
import { useAuth } from "@/contexts/AuthContext";
import {
  Download,
  FileText,
  Printer,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Banknote,
  PiggyBank,
  ArrowDownRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["hsl(158, 64%, 42%)", "hsl(0, 72%, 51%)", "hsl(38, 92%, 50%)"];

export default function FinancialReports() {
  const [monthsBack, setMonthsBack] = useState("6");
  const { data, isLoading } = useFinancialStats(Number(monthsBack));
  const { currentOrganization } = useAuth();

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    if (!data) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Financial Report", pw / 2, 15, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`${currentOrganization?.name || ""} | Last ${monthsBack} months`, pw / 2, 23, { align: "center" });

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const sy = 35;
    doc.text(`Revenue: ${data.totalRevenue.toLocaleString()} SDG`, 20, sy);
    doc.setTextColor(220, 50, 50);
    doc.text(`Expenses: ${data.totalExpenses.toLocaleString()} SDG`, 100, sy);
    doc.setTextColor(200, 150, 0);
    doc.text(`Salaries: ${data.totalSalaries.toLocaleString()} SDG`, 180, sy);
    doc.setTextColor(data.netProfit >= 0 ? 22 : 220, data.netProfit >= 0 ? 163 : 50, data.netProfit >= 0 ? 74 : 50);
    doc.text(`Net Profit: ${data.netProfit.toLocaleString()} SDG`, 250, sy);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 45,
      head: [["Month", "Revenue (SDG)", "Expenses (SDG)", "Salaries (SDG)", "Net Profit (SDG)"]],
      body: data.monthlyData.map((m) => [
        m.month,
        m.revenue.toLocaleString(),
        m.expenses.toLocaleString(),
        m.salaries.toLocaleString(),
        m.netProfit.toLocaleString(),
      ]),
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    });

    doc.save(`Financial_Report_${Date.now()}.pdf`);
  };

  const handleExportExcel = async () => {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const rows = [
      ["Financial Report - " + (currentOrganization?.name || "")],
      [],
      ["Total Revenue", data.totalRevenue],
      ["Total Expenses", data.totalExpenses],
      ["Total Salaries", data.totalSalaries],
      ["Net Profit", data.netProfit],
      [],
      ["Month", "Revenue", "Expenses", "Salaries", "Net Profit"],
      ...data.monthlyData.map((m) => [m.monthLabel, m.revenue, m.expenses, m.salaries, m.netProfit]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
    XLSX.writeFile(wb, `Financial_Report_${Date.now()}.xlsx`);
  };

  const pieData = data
    ? [
        { name: "الإيرادات", value: data.totalRevenue },
        { name: "المصروفات", value: data.totalExpenses },
        { name: "الرواتب", value: data.totalSalaries },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">التقارير المالية</h1>
          <p className="text-muted-foreground mt-1">إيرادات - مصروفات - رواتب = صافي الربح</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={monthsBack} onValueChange={setMonthsBack}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 أشهر</SelectItem>
              <SelectItem value="6">6 أشهر</SelectItem>
              <SelectItem value="12">12 شهر</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPDF} disabled={!data}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportExcel} disabled={!data}>
            <FileText className="w-4 h-4" /> Excel
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> طباعة
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-muted-foreground">لا توجد بيانات</div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="إجمالي الإيرادات"
              value={data.totalRevenue}
              icon={TrendingUp}
              className="bg-success/10 text-success"
            />
            <SummaryCard
              title="إجمالي المصروفات"
              value={data.totalExpenses}
              icon={ArrowDownRight}
              className="bg-destructive/10 text-destructive"
            />
            <SummaryCard
              title="إجمالي الرواتب"
              value={data.totalSalaries}
              icon={Banknote}
              className="bg-warning/10 text-warning"
            />
            <SummaryCard
              title="صافي الربح"
              value={data.netProfit}
              icon={data.netProfit >= 0 ? PiggyBank : TrendingDown}
              className={data.netProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar Chart */}
            <div className="lg:col-span-2 bg-card rounded-2xl shadow-soft border border-border/50 p-4 sm:p-6">
              <h3 className="font-bold text-foreground mb-4">مقارنة شهرية</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => `${v.toLocaleString()} ج.س`}
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="الإيرادات" fill="hsl(158, 64%, 42%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="المصروفات" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="salaries" name="الرواتب" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-4 sm:p-6">
              <h3 className="font-bold text-foreground mb-4">توزيع الأموال</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.س`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Net Profit Trend */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-4 sm:p-6">
            <h3 className="font-bold text-foreground mb-4">اتجاه صافي الربح</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()} ج.س`} />
                  <Line type="monotone" dataKey="netProfit" name="صافي الربح" stroke="hsl(158, 64%, 42%)" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Table */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">تفاصيل شهرية</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">الشهر</th>
                    <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">الإيرادات</th>
                    <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">المصروفات</th>
                    <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">الرواتب</th>
                    <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">صافي الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.monthlyData.map((m) => (
                    <tr key={m.month} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 sm:p-4 font-medium text-foreground">{m.monthLabel}</td>
                      <td className="p-3 sm:p-4 text-success font-medium">{m.revenue.toLocaleString()} ج.س</td>
                      <td className="p-3 sm:p-4 text-destructive font-medium">{m.expenses.toLocaleString()} ج.س</td>
                      <td className="p-3 sm:p-4 text-warning font-medium">{m.salaries.toLocaleString()} ج.س</td>
                      <td className={cn("p-3 sm:p-4 font-bold", m.netProfit >= 0 ? "text-success" : "text-destructive")}>
                        {m.netProfit.toLocaleString()} ج.س
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/5 border-t-2 border-primary font-bold">
                    <td className="p-3 sm:p-4 text-foreground">الإجمالي</td>
                    <td className="p-3 sm:p-4 text-success">{data.totalRevenue.toLocaleString()} ج.س</td>
                    <td className="p-3 sm:p-4 text-destructive">{data.totalExpenses.toLocaleString()} ج.س</td>
                    <td className="p-3 sm:p-4 text-warning">{data.totalSalaries.toLocaleString()} ج.س</td>
                    <td className={cn("p-3 sm:p-4", data.netProfit >= 0 ? "text-success" : "text-destructive")}>
                      {data.netProfit.toLocaleString()} ج.س
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function SummaryCard({ title, value, icon: Icon, className }: { title: string; value: number; icon: any; className: string }) {
  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-soft border border-border/50">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", className)}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-foreground">{value.toLocaleString()} ج.س</p>
    </div>
  );
}
