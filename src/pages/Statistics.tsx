import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranches } from "@/hooks/useBranches";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  MessageSquare,
  Receipt,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
  BarChart3,
  Info,
  Store,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { format, subDays, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444"];

type StatsPeriod = "7d" | "30d" | "90d" | "all";

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوماً",
  "90d": "آخر 90 يوماً",
  "all": "كل الفترات",
};

function getPeriodStartDate(period: StatsPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "7d": return startOfDay(subDays(now, 6));
    case "30d": return startOfDay(subDays(now, 29));
    case "90d": return startOfDay(subDays(now, 89));
    case "all": return null;
  }
}

export default function Statistics() {
  const { currentOrganization } = useAuth();
  const organizationId = currentOrganization?.id;
  const { branches } = useBranches();
  const [period, setPeriod] = useState<StatsPeriod>("30d");
  const periodStart = getPeriodStartDate(period);

  const { data: messagesStats, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages-stats", organizationId, period],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from("whatsapp_messages")
        .select("whatsapp_connection_id, processed, message_type, created_at")
        .eq("organization_id", organizationId);
      if (periodStart) {
        query = query.gte("created_at", periodStart.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: transfersStats, isLoading: loadingTransfers } = useQuery({
    queryKey: ["transfers-stats", organizationId, period],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from("transfers")
        .select("branch_id, is_confirmed, amount, whatsapp_connection_id, created_at, ai_confidence, needs_review")
        .eq("organization_id", organizationId);
      if (periodStart) {
        query = query.gte("created_at", periodStart.toISOString());
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: connections } = useQuery({
    queryKey: ["whatsapp-connections-stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("id, branch_id, status")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const isLoading = loadingMessages || loadingTransfers;

  // Branch stats calculation
  const branchStats = branches?.map((branch) => {
    const branchConnections = connections?.filter((c) => c.branch_id === branch.id) || [];
    const connectionIds = branchConnections.map((c) => c.id);
    const branchMessages = messagesStats?.filter((m) => connectionIds.includes(m.whatsapp_connection_id)) || [];
    const branchTransfers = transfersStats?.filter((t) => t.branch_id === branch.id) || [];
    const whatsappTransfers = branchTransfers.filter((t) => t.whatsapp_connection_id);

    const totalMessages = branchMessages.length;
    const imageMessages = branchMessages.filter((m) => m.message_type === "imageMessage").length;
    const totalTransfers = branchTransfers.length;
    const confirmedTransfers = branchTransfers.filter((t) => t.is_confirmed).length;
    const totalAmount = branchTransfers.reduce((sum, t) => sum + Number(t.amount), 0);
    const extractionRate = imageMessages > 0 ? Math.round((whatsappTransfers.length / imageMessages) * 100) : 0;

    return {
      id: branch.id,
      name: branch.name,
      totalMessages,
      imageMessages,
      processedMessages: branchMessages.filter((m) => m.processed).length,
      totalTransfers,
      whatsappTransfers: whatsappTransfers.length,
      confirmedTransfers,
      pendingTransfers: totalTransfers - confirmedTransfers,
      totalAmount,
      confirmedAmount: branchTransfers.filter((t) => t.is_confirmed).reduce((sum, t) => sum + Number(t.amount), 0),
      extractionRate,
      isConnected: branchConnections.some((c) => c.status === "connected"),
    };
  }) || [];

  // Summary totals
  const totals = {
    messages: messagesStats?.length || 0,
    imageMessages: messagesStats?.filter((m) => m.message_type === "imageMessage").length || 0,
    transfers: transfersStats?.length || 0,
    whatsappTransfers: transfersStats?.filter((t) => t.whatsapp_connection_id).length || 0,
    confirmedTransfers: transfersStats?.filter((t) => t.is_confirmed).length || 0,
    totalAmount: transfersStats?.reduce((sum, t) => sum + Number(t.amount), 0) || 0,
  };

  // ─── NEW CHART DATA ───

  // 1) Daily trend — number of days shown adapts to selected period (capped for readability)
  const trendDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
  const dailyTrendData = (() => {
    const days: { date: string; label: string; تحويلات: number; مبلغ: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayEnd = new Date(day);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayTransfers = transfersStats?.filter((t) => {
        const d = new Date(t.created_at);
        return d >= day && d < dayEnd;
      }) || [];
      days.push({
        date: day.toISOString(),
        label: format(day, "d MMM", { locale: ar }),
        تحويلات: dayTransfers.length,
        مبلغ: dayTransfers.reduce((s, t) => s + Number(t.amount), 0),
      });
    }
    return days;
  })();

  // 2) Confirmation rate donut
  const confirmationData = [
    { name: "مؤكد", value: totals.confirmedTransfers, fill: "#10b981" },
    { name: "قيد المراجعة", value: totals.transfers - totals.confirmedTransfers, fill: "hsl(var(--muted))" },
  ];
  const confirmationRate = totals.transfers > 0 ? Math.round((totals.confirmedTransfers / totals.transfers) * 100) : 0;

  // 3) AI confidence distribution
  const confidenceDistribution = (() => {
    const buckets = [
      { range: "0-49%", label: "منخفض", count: 0, fill: "#ef4444" },
      { range: "50-79%", label: "متوسط", count: 0, fill: "#f59e0b" },
      { range: "80-100%", label: "مرتفع", count: 0, fill: "#10b981" },
    ];
    transfersStats?.forEach((t) => {
      const conf = t.ai_confidence;
      if (conf == null) return;
      if (conf < 50) buckets[0].count++;
      else if (conf < 80) buckets[1].count++;
      else buckets[2].count++;
    });
    return buckets;
  })();

  // 4) Branch revenue comparison bar chart
  const branchRevenueData = branchStats
    .filter((b) => b.totalAmount > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 8)
    .map((b) => ({
      name: b.name.length > 12 ? b.name.substring(0, 12) + "…" : b.name,
      مؤكد: b.confirmedAmount,
      "قيد المراجعة": b.totalAmount - b.confirmedAmount,
    }));

  // Original chart data
  const barChartData = branchStats.map((b) => ({
    name: b.name.length > 15 ? b.name.substring(0, 15) + "..." : b.name,
    رسائل: b.totalMessages,
    صور: b.imageMessages,
    تحويلات: b.whatsappTransfers,
  }));

  const pieChartData = branchStats
    .filter((b) => b.totalAmount > 0)
    .map((b) => ({ name: b.name, value: b.totalAmount }));

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">الإحصائيات</h1>
          </div>
          <p className="text-muted-foreground">
            تحليل مفصل لأداء الفروع والرسائل والتحويلات
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as StatsPeriod)}>
          <SelectTrigger className="w-full sm:w-48 gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map((key) => (
              <SelectItem key={key} value={key}>{PERIOD_LABELS[key]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الرسائل</p>
                    <p className="text-2xl font-bold">{totals.messages}</p>
                    <p className="text-xs text-muted-foreground mt-1">{totals.imageMessages} صورة</p>
                  </div>
                  <MessageSquare className="w-10 h-10 text-primary opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">التحويلات المستخرجة</p>
                    <p className="text-2xl font-bold">{totals.whatsappTransfers}</p>
                    <p className="text-xs text-muted-foreground mt-1">من {totals.imageMessages} صورة</p>
                  </div>
                  <Receipt className="w-10 h-10 text-secondary opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">معدل الاستخراج</p>
                    <p className="text-2xl font-bold">
                      {totals.imageMessages > 0 ? Math.round((totals.whatsappTransfers / totals.imageMessages) * 100) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">نسبة النجاح</p>
                  </div>
                  <TrendingUp className="w-10 h-10 text-accent opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي المبالغ</p>
                    <p className="text-2xl font-bold">{totals.totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">ج.س</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── NEW: Daily Trend Chart ── */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                اتجاه التحويلات — {PERIOD_LABELS[period]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrendData.some((d) => d.تحويلات > 0) ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyTrendData}>
                    <defs>
                      <linearGradient id="colorTransfers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === "مبلغ" ? `${value.toLocaleString()} ج.س` : value
                      }
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="تحويلات"
                      stroke="hsl(var(--primary))"
                      fill="url(#colorTransfers)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="مبلغ"
                      stroke="hsl(var(--accent))"
                      strokeWidth={2}
                      dot={false}
                      yAxisId={0}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground gap-2">
                  <Info className="w-8 h-8 opacity-50" />
                  <p className="text-sm">لا توجد تحويلات في {PERIOD_LABELS[period]}</p>
                  <p className="text-xs">أرسل صورة إيصال عبر واتساب لبدء تتبع البيانات</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── NEW: Confirmation Rate + AI Confidence ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Confirmation Rate Donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  معدل التأكيد
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totals.transfers > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={confirmationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          {confirmationData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3 flex-1">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-foreground">{confirmationRate}%</p>
                        <p className="text-xs text-muted-foreground">نسبة التأكيد</p>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            مؤكد
                          </span>
                          <span className="font-medium">{totals.confirmedTransfers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-muted" />
                            قيد المراجعة
                          </span>
                          <span className="font-medium">{totals.transfers - totals.confirmedTransfers}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">
                    لا توجد تحويلات بعد
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Confidence Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🤖 توزيع ثقة الذكاء الاصطناعي
                </CardTitle>
              </CardHeader>
              <CardContent>
                {confidenceDistribution.some((b) => b.count > 0) ? (
                  <div className="space-y-5">
                    {confidenceDistribution.map((bucket) => {
                      const totalWithAI = confidenceDistribution.reduce((s, b) => s + b.count, 0);
                      const pct = totalWithAI > 0 ? Math.round((bucket.count / totalWithAI) * 100) : 0;
                      return (
                        <div key={bucket.range} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: bucket.fill }} />
                              {bucket.label} ({bucket.range})
                            </span>
                            <span className="font-medium">{bucket.count} ({pct}%)</span>
                          </div>
                          <Progress value={pct} className="h-2.5" />
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      كلما ارتفعت نسبة الثقة، زادت دقة الاستخراج التلقائي للبيانات
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[160px] text-muted-foreground text-sm gap-1">
                    <p>لا توجد بيانات ثقة AI بعد</p>
                    <p className="text-xs">تظهر هنا عند استخراج تحويلات عبر واتساب</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── NEW: Branch Revenue Comparison (stacked bar) ── */}
          {branchRevenueData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="w-5 h-5 text-secondary" />
                  مقارنة إيرادات الفروع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={branchRevenueData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(value: number) => `${value.toLocaleString()} ج.س`} />
                    <Legend />
                    <Bar dataKey="مؤكد" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="قيد المراجعة" stackId="a" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Original Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الرسائل والتحويلات حسب الفرع</CardTitle>
              </CardHeader>
              <CardContent>
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="رسائل" fill="hsl(var(--primary))" />
                      <Bar dataKey="صور" fill="hsl(var(--secondary))" />
                      <Bar dataKey="تحويلات" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-2">
                    <Info className="w-8 h-8 opacity-50" />
                    <p className="text-sm">لا توجد بيانات</p>
                    <p className="text-xs">أضف فرعاً واربط واتساب لبدء تتبع الرسائل</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">توزيع المبالغ حسب الفرع</CardTitle>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name.substring(0, 10)}${name.length > 10 ? "..." : ""} (${(percent * 100).toFixed(0)}%)`
                        }
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value.toLocaleString()} ج.س`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تفاصيل الفروع</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                    <TableHead className="text-center">الرسائل</TableHead>
                    <TableHead className="text-center">الصور</TableHead>
                    <TableHead className="text-center">التحويلات</TableHead>
                    <TableHead className="text-center">معدل الاستخراج</TableHead>
                    <TableHead className="text-center">المبلغ الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchStats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        <div className="space-y-1">
                          <p>لا توجد فروع</p>
                          <p className="text-xs">أضف فرعاً من صفحة <a href="/branches" className="text-primary underline">الفروع</a> للبدء</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    branchStats.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell className="text-center">
                          {branch.isConnected ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" /> متصل
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500">
                              <XCircle className="w-4 h-4" /> غير متصل
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{branch.totalMessages}</TableCell>
                        <TableCell className="text-center">{branch.imageMessages}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{branch.whatsappTransfers}</span>
                          <span className="text-muted-foreground text-xs mr-1">({branch.confirmedTransfers} مؤكد)</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2">
                            <Progress value={branch.extractionRate} className="h-2 w-16" />
                            <span className="text-sm">{branch.extractionRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{branch.totalAmount.toLocaleString()} ج.س</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
