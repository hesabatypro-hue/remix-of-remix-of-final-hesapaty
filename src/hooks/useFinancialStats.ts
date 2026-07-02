import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ar } from "date-fns/locale";

export interface MonthlyFinancial {
  month: string;
  monthLabel: string;
  revenue: number;
  expenses: number;
  salaries: number;
  netProfit: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalSalaries: number;
  netProfit: number;
  monthlyData: MonthlyFinancial[];
}

export function useFinancialStats(monthsBack = 6) {
  const { currentOrganization } = useAuth();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ["financial-stats", orgId, monthsBack],
    queryFn: async (): Promise<FinancialSummary> => {
      if (!orgId) throw new Error("No org");

      const now = new Date();
      const startDate = startOfMonth(subMonths(now, monthsBack - 1));

      // Fetch all three data sources in parallel
      const [transfersRes, expensesRes, salariesRes] = await Promise.all([
        supabase
          .from("transfers")
          .select("amount, is_confirmed, transfer_date")
          .eq("organization_id", orgId)
          .gte("transfer_date", format(startDate, "yyyy-MM-dd")),
        supabase
          .from("expenses")
          .select("amount, expense_date")
          .eq("organization_id", orgId)
          .eq("is_deleted", false)
          .gte("expense_date", format(startDate, "yyyy-MM-dd")),
        supabase
          .from("salary_payments")
          .select("net_amount, month, year, status")
          .eq("organization_id", orgId)
          .eq("status", "paid"),
      ]);

      if (transfersRes.error) throw transfersRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (salariesRes.error) throw salariesRes.error;

      // Build monthly buckets
      const monthlyMap = new Map<string, MonthlyFinancial>();
      for (let i = 0; i < monthsBack; i++) {
        const d = subMonths(now, monthsBack - 1 - i);
        const key = format(d, "yyyy-MM");
        monthlyMap.set(key, {
          month: key,
          monthLabel: format(d, "MMMM yyyy", { locale: ar }),
          revenue: 0,
          expenses: 0,
          salaries: 0,
          netProfit: 0,
        });
      }

      // Aggregate revenue (confirmed transfers)
      (transfersRes.data || []).forEach((t) => {
        if (!t.is_confirmed) return;
        const key = t.transfer_date?.substring(0, 7);
        const bucket = monthlyMap.get(key!);
        if (bucket) bucket.revenue += Number(t.amount);
      });

      // Aggregate expenses
      (expensesRes.data || []).forEach((e) => {
        const key = e.expense_date?.substring(0, 7);
        const bucket = monthlyMap.get(key!);
        if (bucket) bucket.expenses += Number(e.amount);
      });

      // Aggregate salaries
      (salariesRes.data || []).forEach((s) => {
        const key = `${s.year}-${String(s.month).padStart(2, "0")}`;
        const bucket = monthlyMap.get(key);
        if (bucket) bucket.salaries += Number(s.net_amount);
      });

      // Calculate net profit
      let totalRevenue = 0, totalExpenses = 0, totalSalaries = 0;
      const monthlyData: MonthlyFinancial[] = [];
      monthlyMap.forEach((v) => {
        v.netProfit = v.revenue - v.expenses - v.salaries;
        totalRevenue += v.revenue;
        totalExpenses += v.expenses;
        totalSalaries += v.salaries;
        monthlyData.push(v);
      });

      return {
        totalRevenue,
        totalExpenses,
        totalSalaries,
        netProfit: totalRevenue - totalExpenses - totalSalaries,
        monthlyData,
      };
    },
    enabled: !!orgId,
    staleTime: 30000,
  });
}

// Current month stats for dashboard
export function useCurrentMonthFinancials() {
  const { currentOrganization } = useAuth();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ["current-month-financials", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("No org");

      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [transfersRes, expensesRes, salariesRes] = await Promise.all([
        supabase
          .from("transfers")
          .select("amount, is_confirmed")
          .eq("organization_id", orgId)
          .gte("transfer_date", monthStart)
          .lte("transfer_date", monthEnd),
        supabase
          .from("expenses")
          .select("amount")
          .eq("organization_id", orgId)
          .eq("is_deleted", false)
          .gte("expense_date", monthStart)
          .lte("expense_date", monthEnd),
        supabase
          .from("salary_payments")
          .select("net_amount")
          .eq("organization_id", orgId)
          .eq("status", "paid")
          .eq("month", currentMonth)
          .eq("year", currentYear),
      ]);

      const revenue = (transfersRes.data || [])
        .filter((t) => t.is_confirmed)
        .reduce((s, t) => s + Number(t.amount), 0);
      const expenses = (expensesRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
      const salaries = (salariesRes.data || []).reduce((s, p) => s + Number(p.net_amount), 0);

      return { revenue, expenses, salaries, netProfit: revenue - expenses - salaries };
    },
    enabled: !!orgId,
    refetchInterval: 10000,
  });
}
