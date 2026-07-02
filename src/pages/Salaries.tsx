import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEmployees } from "@/hooks/useEmployees";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Wallet, CheckCircle, Clock } from "lucide-react";

const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const Salaries = () => {
  const { employees, salaryPayments, salariesLoading, addSalaryPayment, totalSalaries } = useEmployees();
  const [showPay, setShowPay] = useState(false);
  const now = new Date();

  const [form, setForm] = useState({
    employee_id: "",
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    deductions: "0",
    bonuses: "0",
    notes: "",
  });

  const selectedEmployee = employees.find(e => e.id === form.employee_id);
  const baseAmount = selectedEmployee ? Number(selectedEmployee.base_salary) : 0;
  const netAmount = baseAmount - Number(form.deductions || 0) + Number(form.bonuses || 0);

  const handlePay = async () => {
    if (!form.employee_id || netAmount <= 0) return;
    await addSalaryPayment.mutateAsync({
      employee_id: form.employee_id,
      month: Number(form.month),
      year: Number(form.year),
      base_amount: baseAmount,
      deductions: Number(form.deductions || 0),
      bonuses: Number(form.bonuses || 0),
      net_amount: netAmount,
      notes: form.notes || undefined,
    });
    setForm({ employee_id: "", month: String(now.getMonth() + 1), year: String(now.getFullYear()), deductions: "0", bonuses: "0", notes: "" });
    setShowPay(false);
  };

  const paidCount = salaryPayments.filter(p => p.status === 'paid').length;
  const pendingCount = salaryPayments.filter(p => p.status === 'pending').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">الرواتب</h1>
            <p className="text-muted-foreground">سجل دفعات رواتب الموظفين</p>
          </div>
          <Dialog open={showPay} onOpenChange={setShowPay}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 ml-1" />دفع راتب</Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader><DialogTitle>دفع راتب موظف</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الموظف *</label>
                  <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {employees.filter(e => e.is_active).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.full_name} — <SelectItem key={e.id} value={e.id}>{e.full_name} — {Number(e.base_salary).toLocaleString()} ج.س</SelectItem></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">الشهر</label>
                    <Select value={form.month} onValueChange={v => setForm(p => ({ ...p, month: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">السنة</label>
                    <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} />
                  </div>
                </div>
                {selectedEmployee && (
                  <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                    <p>الراتب الأساسي: <span className="font-bold"><p>الراتب الأساسي: <span className="font-bold">{baseAmount.toLocaleString()} ج.س</span></p></span></p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">خصومات</label>
                    <Input type="number" value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">مكافآت</label>
                    <Input type="number" value={form.bonuses} onChange={e => setForm(p => ({ ...p, bonuses: e.target.value }))} />
                  </div>
                </div>
                {selectedEmployee && (
                  <div className="bg-primary/5 p-3 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">صافي الراتب</p>
                    <p className="text-2xl font-bold text-primary"><p className="text-2xl font-bold text-primary">{netAmount.toLocaleString()} ج.س</p></p>
                  </div>
                )}
                <Textarea placeholder="ملاحظات (اختياري)" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={handlePay} disabled={!form.employee_id || netAmount <= 0 || addSalaryPayment.isPending} className="w-full">
                  {addSalaryPayment.isPending ? "جاري الدفع..." : "تأكيد الدفع"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Wallet className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المدفوعات</p>
                <p className="text-xl font-bold"><p className="text-xl font-bold">{totalSalaries.toLocaleString()} ج.س</p></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">دفعات مكتملة</p>
                <p className="text-xl font-bold">{paidCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">قيد الانتظار</p>
                <p className="text-xl font-bold">{pendingCount}</p>
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
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">الشهر</TableHead>
                    <TableHead className="text-right">الأساسي</TableHead>
                    <TableHead className="text-right">خصومات</TableHead>
                    <TableHead className="text-right">مكافآت</TableHead>
                    <TableHead className="text-right">الصافي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salariesLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                  ) : salaryPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد دفعات مسجلة</TableCell></TableRow>
                  ) : salaryPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.employees?.full_name || "—"}</TableCell>
                      <TableCell>{months[p.month - 1]} {p.year}</TableCell>
                      <TableCell>{Number(p.base_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-destructive">{Number(p.deductions) > 0 ? `-${Number(p.deductions).toLocaleString()}` : "—"}</TableCell>
                      <TableCell className="text-green-600">{Number(p.bonuses) > 0 ? `+${Number(p.bonuses).toLocaleString()}` : "—"}</TableCell>
                      <TableCell className="font-bold"><TableCell className="font-bold">{Number(p.net_amount).toLocaleString()} ج.س</TableCell></TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'paid' ? "default" : "secondary"}>
                          {p.status === 'paid' ? "مدفوع" : "قيد الانتظار"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Salaries;
