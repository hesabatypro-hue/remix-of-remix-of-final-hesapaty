import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useExpenses } from "@/hooks/useExpenses";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Receipt, Trash2, Tag, TrendingDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const Expenses = () => {
  const { expenses, expensesLoading, categories, addExpense, addCategory, deleteExpense, totalExpenses } = useExpenses();
  const { branches } = useBranches();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [newExpense, setNewExpense] = useState({
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
    category_id: "",
    branch_id: "",
    notes: "",
  });

  const [newCategory, setNewCategory] = useState({ name: "", color: "#6366f1" });

  const handleAddExpense = async () => {
    if (!newExpense.amount || Number(newExpense.amount) <= 0) return;
    await addExpense.mutateAsync({
      amount: Number(newExpense.amount),
      description: newExpense.description || undefined,
      expense_date: newExpense.expense_date,
      category_id: newExpense.category_id || undefined,
      branch_id: newExpense.branch_id || undefined,
      notes: newExpense.notes || undefined,
    });
    setNewExpense({ amount: "", description: "", expense_date: new Date().toISOString().split("T")[0], category_id: "", branch_id: "", notes: "" });
    setShowAddExpense(false);
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    await addCategory.mutateAsync(newCategory);
    setNewCategory({ name: "", color: "#6366f1" });
    setShowAddCategory(false);
  };

  const filteredExpenses = filterCategory === "all"
    ? expenses
    : expenses.filter(e => e.category_id === filterCategory);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">المصروفات</h1>
            <p className="text-muted-foreground">إدارة وتتبع مصروفات المنظمة</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="h-4 w-4 ml-1" />
                  فئة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة فئة مصروفات</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="اسم الفئة (مثال: إيجار، كهرباء)" value={newCategory.name} onChange={e => setNewCategory(p => ({ ...p, name: e.target.value }))} />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">اللون:</label>
                    <input type="color" value={newCategory.color} onChange={e => setNewCategory(p => ({ ...p, color: e.target.value }))} className="w-10 h-10 rounded cursor-pointer" />
                  </div>
                  <Button onClick={handleAddCategory} disabled={!newCategory.name} className="w-full">إضافة الفئة</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة مصروف
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-md">
                <DialogHeader>
                  <DialogTitle>إضافة مصروف جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">المبلغ *</label>
                    <Input type="number" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">الوصف</label>
                    <Input placeholder="وصف المصروف" value={newExpense.description} onChange={e => setNewExpense(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">التاريخ</label>
                    <Input type="date" value={newExpense.expense_date} onChange={e => setNewExpense(p => ({ ...p, expense_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">الفئة</label>
                    <Select value={newExpense.category_id} onValueChange={v => setNewExpense(p => ({ ...p, category_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">الفرع</label>
                    <Select value={newExpense.branch_id} onValueChange={v => setNewExpense(p => ({ ...p, branch_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="اختر الفرع (اختياري)" /></SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">ملاحظات</label>
                    <Textarea placeholder="ملاحظات إضافية" value={newExpense.notes} onChange={e => setNewExpense(p => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <Button onClick={handleAddExpense} disabled={!newExpense.amount || addExpense.isPending} className="w-full">
                    {addExpense.isPending ? "جاري الإضافة..." : "إضافة المصروف"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المصروفات</p>
                <p className="text-xl font-bold">{totalExpenses.toLocaleString()} ج.س</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد المصروفات</p>
                <p className="text-xl font-bold">{expenses.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Tag className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">فئات المصروفات</p>
                <p className="text-xl font-bold">{categories.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="كل الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">الفئة</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expensesLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : filteredExpenses.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مصروفات مسجلة</TableCell></TableRow>
                  ) : filteredExpenses.map(expense => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.expense_date), "dd MMM yyyy", { locale: ar })}</TableCell>
                      <TableCell>{expense.description || "—"}</TableCell>
                      <TableCell>
                        {expense.expense_categories ? (
                          <Badge variant="outline" style={{ borderColor: expense.expense_categories.color, color: expense.expense_categories.color }}>
                            {expense.expense_categories.name}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{expense.branches?.name || "—"}</TableCell>
                      <TableCell className="font-semibold text-destructive">{Number(expense.amount).toLocaleString()} ج.س</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(expense.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد حذف المصروف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) deleteExpense.mutate(deleteTarget);
                  setDeleteTarget(null);
                }}
              >
                حذف
              </AlertDialogAction>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Expenses;
