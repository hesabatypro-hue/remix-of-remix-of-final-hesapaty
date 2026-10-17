import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { newIdempotencyKey, isIdempotencyReplay } from "@/lib/idempotency";

export interface Employee {
  id: string;
  organization_id: string;
  branch_id: string | null;
  full_name: string;
  position: string | null;
  base_salary: number;
  hire_date: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  branches?: { name: string } | null;
}

export interface SalaryPayment {
  id: string;
  employee_id: string;
  organization_id: string;
  month: number;
  year: number;
  base_amount: number;
  deductions: number;
  bonuses: number;
  net_amount: number;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  employees?: Employee;
}

export const useEmployees = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, user } = useAuth();
  const orgId = currentOrganization?.id;

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, branches(name)')
        .eq('organization_id', orgId!)
        .order('full_name');
      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!orgId,
  });

  const { data: salaryPayments = [], isLoading: salariesLoading } = useQuery({
    queryKey: ['salary-payments', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_payments')
        .select('*, employees(*)')
        .eq('organization_id', orgId!)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data as SalaryPayment[];
    },
    enabled: !!orgId,
  });

  const addEmployee = useMutation({
    mutationFn: async (emp: {
      full_name: string;
      position?: string;
      base_salary: number;
      hire_date?: string;
      phone?: string;
      branch_id?: string;
    }) => {
      const { error } = await supabase.from('employees').insert({
        organization_id: orgId!,
        ...emp,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', orgId] });
      toast({ title: "تم الإضافة", description: "تمت إضافة الموظف بنجاح" });
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async (params: { id: string; full_name?: string; position?: string; base_salary?: number; phone?: string; is_active?: boolean; branch_id?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase.from('employees').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', orgId] });
      toast({ title: "تم التحديث", description: "تم تحديث بيانات الموظف" });
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', orgId] });
      queryClient.invalidateQueries({ queryKey: ['salary-payments', orgId] });
      toast({ title: "تم الحذف", description: "تم حذف الموظف بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف الموظف. قد يكون مرتبطاً بسجلات رواتب.", variant: "destructive" });
    },
  });

  const addSalaryPayment = useMutation({
    mutationFn: async (payment: {
      employee_id: string;
      month: number;
      year: number;
      base_amount: number;
      deductions?: number;
      bonuses?: number;
      net_amount: number;
      notes?: string;
    }) => {
      const { error } = await (supabase.from('salary_payments') as any).insert({
        organization_id: orgId!,
        paid_by: user?.id,
        status: 'paid',
        paid_at: new Date().toISOString(),
        idempotency_key: newIdempotencyKey(),
        ...payment,
      });
      if (error && !isIdempotencyReplay(error)) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-payments', orgId] });
      toast({ title: "تم الدفع", description: "تم تسجيل دفعة الراتب بنجاح" });
    },
    onError: (error: any) => {
      const msg = error.message?.includes('unique') ? "تم دفع راتب هذا الشهر مسبقاً لهذا الموظف" : "فشل في تسجيل الدفعة";
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const totalSalaries = salaryPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.net_amount), 0);

  return {
    employees, isLoading,
    salaryPayments, salariesLoading,
    addEmployee, updateEmployee, deleteEmployee,
    addSalaryPayment,
    totalSalaries,
  };
};
