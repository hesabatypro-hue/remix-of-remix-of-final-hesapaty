import { useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AppTutorial } from "@/components/tutorial/AppTutorial";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentTransfers } from "@/components/dashboard/RecentTransfers";
import { BranchPerformance } from "@/components/dashboard/BranchPerformance";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { DashboardFilters, TimePeriod, timePeriodLabels } from "@/components/dashboard/DashboardFilters";
import { ConnectionAlert } from "@/components/dashboard/ConnectionAlert";
import { ReviewAlert } from "@/components/dashboard/ReviewAlert";
import {
  Banknote,
  Store,
  Receipt,
  Clock,
  Calendar,
  Wallet,
  TrendingDown,
  PiggyBank,
} from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useCurrentMonthFinancials } from "@/hooks/useFinancialStats";
import { DashboardSkeleton } from "@/components/ui/page-skeleton";
import { useBranches } from "@/hooks/useBranches";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function Dashboard() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("all");
  const [customMonth, setCustomMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedBranch, setSelectedBranch] = useState("all");

  const { data: stats, isLoading } = useDashboardStats({ timePeriod, branchId: selectedBranch, customMonth });
  const { data: financials } = useCurrentMonthFinancials();
  const { branches } = useBranches();

  const today = format(new Date(), "EEEE، d MMMM yyyy", { locale: ar });
  
  const branchName = selectedBranch === "all" 
    ? "جميع الفروع" 
    : branches?.find(b => b.id === selectedBranch)?.name || "";

  return (
    <DashboardLayout>
      {/* In-app Tutorial */}
      <AppTutorial />

      {/* Connection Alert */}
      <ConnectionAlert />

      {/* Review Alert */}
      <ReviewAlert />

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Calendar className="w-4 h-4" />
          <span>{today}</span>
        </div>
        <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">
          ملخص إيرادات {branchName} — {timePeriodLabels[timePeriod]}
        </p>
        {stats?.totalTransfers === 0 && !isLoading && (
          <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
            👋 مرحباً! ابدأ بربط واتساب من <a href="/whatsapp" className="text-primary underline">إعدادات واتساب</a> لاستقبال التحويلات تلقائياً، أو <a href="/transfers" className="text-primary underline">أضف تحويلاً يدوياً</a>.
          </div>
        )}
      </div>

      {/* Filters */}
      <DashboardFilters
        timePeriod={timePeriod}
        onTimePeriodChange={setTimePeriod}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        branches={branches?.map(b => ({ id: b.id, name: b.name })) || []}
        customMonth={customMonth}
        onCustomMonthChange={setCustomMonth}
      />

      {/* Stats Grid */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={`إيرادات ${timePeriodLabels[timePeriod]}`}
            value={`${(stats?.periodRevenue || 0).toLocaleString()} ج.س`}
            change={`${stats?.confirmedTransfers || 0} تحويل مؤكد`}
            changeType="positive"
            icon={Banknote}
            iconColor="primary"
          />
          <StatCard
            title="عدد الفروع النشطة"
            value={String(stats?.activeBranches || 0)}
            change={`من أصل ${stats?.totalBranches || 0} فرع`}
            changeType="neutral"
            icon={Store}
            iconColor="secondary"
          />
          <StatCard
            title={`تحويلات ${timePeriodLabels[timePeriod]}`}
            value={String(stats?.periodTransfers || 0)}
            change={`من إجمالي ${stats?.totalTransfers || 0} تحويل`}
            changeType="positive"
            icon={Receipt}
            iconColor="accent"
          />
          <StatCard
            title="قيد المراجعة"
            value={String(stats?.pendingTransfers || 0)}
            change="بانتظار التأكيد"
            changeType={stats?.pendingTransfers ? "negative" : "positive"}
            icon={Clock}
            iconColor="warning"
          />
        </div>

        {/* Financial Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="مصروفات الشهر"
            value={`${(financials?.expenses || 0).toLocaleString()} ج.س`}
            change="المصروفات التشغيلية"
            changeType="negative"
            icon={Wallet}
            iconColor="destructive"
          />
          <StatCard
            title="رواتب الشهر"
            value={`${(financials?.salaries || 0).toLocaleString()} ج.س`}
            change="الرواتب المدفوعة"
            changeType="neutral"
            icon={Banknote}
            iconColor="warning"
          />
          <StatCard
            title="صافي الربح"
            value={`${(financials?.netProfit || 0).toLocaleString()} ج.س`}
            change="إيرادات - مصروفات - رواتب"
            changeType={(financials?.netProfit || 0) >= 0 ? "positive" : "negative"}
            icon={PiggyBank}
            iconColor={(financials?.netProfit || 0) >= 0 ? "success" : "destructive"}
          />
        </div>
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transfers - Takes 2 columns */}
        <div className="lg:col-span-2">
          <RecentTransfers />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <QuickActions />
          <BranchPerformance />
        </div>
      </div>
        </>
      )}
    </DashboardLayout>
  );
}
