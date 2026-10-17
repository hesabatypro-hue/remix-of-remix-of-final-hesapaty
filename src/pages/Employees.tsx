import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEmployees } from "@/hooks/useEmployees";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, UserCheck, UserX, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface EditForm {
  id: string;
  full_name: string;
  position: string;
  base_salary: string;
  phone: string;
  branch_id: string;
  is_active: boolean;
}

const Employees = () => {
  const { employees, isLoading, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { branches } = useBranches();
  const [showAdd, setShowAdd] = useState(false);
  const [editDialog, setEditDialog] = useState<EditForm | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    position: "",
    base_salary: "",
    hire_date: new Date().toISOString().split("T")[0],
    phone: "",
    branch_id: "",
  });

  const handleAdd = async () => {
    if (!form.full_name || !form.base_salary) return;
    await addEmployee.mutateAsync({
      full_name: form.full_name,
      position: form.position || undefined,
      base_salary: Number(form.base_salary),
      hire_date: form.hire_date,
      phone: form.phone || undefined,
      branch_id: form.branch_id || undefined,
    });
    setForm({ full_name: "", position: "", base_salary: "", hire_date: new Date().toISOString().split("T")[0], phone: "", branch_id: "" });
    setShowAdd(false);
  };

  const handleEdit = async () => {
    if (!editDialog || !editDialog.full_name) return;
    await updateEmployee.mutateAsync({
      id: editDialog.id,
      full_name: editDialog.full_name,
      position: editDialog.position || undefined,
      base_salary: Number(editDialog.base_salary),
      phone: editDialog.phone || undefined,
      branch_id: editDialog.branch_id || undefined,
      is_active: editDialog.is_active,
    });
    setEditDialog(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteEmployee.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const openEdit = (emp: any) => {
    setEditDialog({
      id: emp.id,
      full_name: emp.full_name,
      position: emp.position || "",
      base_salary: String(emp.base_salary),
      phone: emp.phone || "",
      branch_id: emp.branch_id || "",
      is_active: emp.is_active,
    });
  };

  const activeCount = employees.filter(e => e.is_active).length;
  const totalSalaries = employees.filter(e => e.is_active).reduce((s, e) => s + Number(e.base_salary), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">الموظفين</h1>
            <p className="text-muted-foreground">إدارة بيانات الموظفين والرواتب</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-1" />إضافة موظف</Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader><DialogTitle>إضافة موظف جديد</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم الكامل *</label>
                  <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="اسم الموظف" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">المنصب</label>
                  <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="مثال: محاسب" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الراتب الأساسي *</label>
                  <Input type="number" value={form.base_salary} onChange={e => setForm(p => ({ ...p, base_salary: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">تاريخ التعيين</label>
                  <Input type="date" value={form.hire_date} onChange={e => setForm(p => ({ ...p, hire_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الهاتف</label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="رقم الهاتف" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الفرع</label>
                  <Select value={form.branch_id} onValueChange={v => setForm(p => ({ ...p, branch_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع (اختياري)" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={!form.full_name || !form.base_salary || addEmployee.isPending} className="w-full">
                  {addEmployee.isPending ? "جاري الإضافة..." : "إضافة الموظف"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Users className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                <p className="text-xl font-bold">{employees.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg"><UserCheck className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">الموظفين النشطين</p>
                <p className="text-xl font-bold">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg"><UserX className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الرواتب الشهرية</p>
                <p className="text-xl font-bold"><p className="text-xl font-bold">{totalSalaries.toLocaleString()} ج.س</p></p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المنصب</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الراتب</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">تاريخ التعيين</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : employees.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا يوجد موظفين مسجلين</TableCell></TableRow>
                  ) : employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell>{emp.position || "—"}</TableCell>
                      <TableCell>{emp.branches?.name || "—"}</TableCell>
                      <TableCell className="font-semibold"><TableCell className="font-semibold">{Number(emp.base_salary).toLocaleString()} ج.س</TableCell></TableCell>
                      <TableCell className="hidden sm:table-cell">{format(new Date(emp.hire_date), "dd MMM yyyy", { locale: ar })}</TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? "default" : "secondary"}>
                          {emp.is_active ? "نشط" : "غير نشط"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(emp)} className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(emp.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editDialog} onOpenChange={open => !open && setEditDialog(null)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader><DialogTitle>تعديل بيانات الموظف</DialogTitle></DialogHeader>
            {editDialog && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الاسم الكامل *</label>
                  <Input value={editDialog.full_name} onChange={e => setEditDialog(p => p ? { ...p, full_name: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">المنصب</label>
                  <Input value={editDialog.position} onChange={e => setEditDialog(p => p ? { ...p, position: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الراتب الأساسي *</label>
                  <Input type="number" value={editDialog.base_salary} onChange={e => setEditDialog(p => p ? { ...p, base_salary: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الهاتف</label>
                  <Input value={editDialog.phone} onChange={e => setEditDialog(p => p ? { ...p, phone: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">الفرع</label>
                  <Select value={editDialog.branch_id} onValueChange={v => setEditDialog(p => p ? { ...p, branch_id: v } : p)}>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">الحالة:</label>
                  <Button
                    variant={editDialog.is_active ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setEditDialog(p => p ? { ...p, is_active: !p.is_active } : p)}
                  >
                    {editDialog.is_active ? "نشط" : "غير نشط"}
                  </Button>
                </div>
                <Button onClick={handleEdit} disabled={!editDialog.full_name || !editDialog.base_salary || updateEmployee.isPending} className="w-full">
                  {updateEmployee.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف الموظف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row-reverse gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleteEmployee.isPending ? "جاري الحذف..." : "حذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Employees;
