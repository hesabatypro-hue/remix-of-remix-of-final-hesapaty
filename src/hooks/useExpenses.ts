import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { newIdempotencyKey, isIdempotencyReplay } from "@/lib/idempotency";

export interface ExpenseCategory {
  id: string;
  organization_id: string;
  name: string;
  icon: string;
  color: string;
  is_system: boolean;
  is_active: boolean;
}

export interface Expense {
  id: string;
  organization_id: string;
  branch_id: string | null;
  category_id: string | null;
  amount: number;
  description: string | null;
  expense_date: string;
  receipt_image_url: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  expense_categories?: ExpenseCategory;
  branches?: { name: string } | null;
}

export const useExpenses = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentOrganization, user } = useAuth();
  const orgId = currentOrganization?.id;

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['expense-categories', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ExpenseCategory[];
    },
    enabled: !!orgId,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_categories(*), branches(name)')
        .eq('organization_id', orgId!)
        .eq('is_deleted', false)
        .order('expense_date', { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!orgId,
  });

  const addCategory = useMutation({
    mutationFn: async (cat: { name: string; icon?: string; color?: string }) => {
      const { error } = await supabase.from('expense_categories').insert({
        organization_id: orgId!,
        name: cat.name,
        icon: cat.icon || 'receipt',
        color: cat.color || '#6366f1',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories', orgId] });
      toast({ title: "تم الإضافة", description: "تمت إضافة الفئة بنجاح" });
    },
  });

  const addExpense = useMutation({
    mutationFn: async (expense: {
      amount: number;
      description?: string;
      expense_date: string;
      category_id?: string;
      branch_id?: string;
      notes?: string;
      is_recurring?: boolean;
      recurrence_type?: string;
    }) => {
      const { error } = await (supabase.from('expenses') as any).insert({
        organization_id: orgId!,
        created_by: user?.id,
        idempotency_key: newIdempotencyKey(),
        ...expense,
      });
      if (error && !isIdempotencyReplay(error)) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', orgId] });
      toast({ title: "تم الإضافة", description: "تمت إضافة المصروف بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message?.includes('INVALID_EXPENSE_AMOUNT') ? "المبلغ يجب أن يكون أكبر من صفر" : "فشل في إضافة المصروف", variant: "destructive" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc('soft_delete_expense', {
        _expense_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', orgId] });
      toast({ title: "تم الحذف", description: "تم حذف المصروف" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message?.includes('NOT_AUTHORIZED')
          ? "ليس لديك صلاحية حذف هذا المصروف"
          : error.message?.includes('EXPENSE_NOT_FOUND')
            ? "المصروف غير موجود أو تم حذفه بالفعل"
            : "فشل في حذف المصروف",
        variant: "destructive"
      });
    },
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    categories, categoriesLoading,
    expenses, expensesLoading,
    addCategory, addExpense, deleteExpense,
    totalExpenses,
  };
};
