import { useState } from "react";
import { Navigate as RouterNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Plus, Download, Pencil, Trash2, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useInvoices, type InvoiceInput, type InvoiceItem } from "@/hooks/useInvoices";
import { generateInvoicePdf } from "@/utils/invoicePdf";

const emptyItem: InvoiceItem = { description: "", quantity: 1, unit_price: 0, total: 0 };

const blankInput = (): InvoiceInput => {
  const today = new Date().toISOString().slice(0, 10);
  const num = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  return {
    invoice_number: num,
    invoice_date: today,
    due_date: "",
    from_company: "",
    from_address: "",
    from_email: "",
    to_client: "",
    to_address: "",
    to_email: "",
    project_name: "",
    status: "draft",
    currency: "USD",
    tax_rate: 0,
    notes: "",
    items: [{ ...emptyItem }],
  };
};

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-muted text-muted-foreground" },
  sent: { label: "مرسلة", color: "bg-primary/10 text-primary" },
  paid: { label: "مدفوعة", color: "bg-success/10 text-success" },
  overdue: { label: "متأخرة", color: "bg-destructive/10 text-destructive" },
};

export default function Invoices() {
  const { currentOrganization } = useAuth();
  const { list, create, update, remove, getInvoice } = useInvoices();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceInput>(blankInput());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (currentOrganization && !currentOrganization.invoicing_enabled) {
    return <RouterNavigate to="/dashboard" replace />;
  }

  const subtotal = form.items.reduce(
    (s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
    0
  );
  const taxAmount = subtotal * ((Number(form.tax_rate) || 0) / 100);
  const totalAmount = subtotal + taxAmount;

  const openNew = () => {
    setEditingId(null);
    setForm(blankInput());
    setDialogOpen(true);
  };

  const openEdit = async (id: string) => {
    const inv = await getInvoice(id);
    setEditingId(id);
    setForm({
      invoice_number: inv.invoice_number,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date || "",
      from_company: inv.from_company,
      from_address: inv.from_address || "",
      from_email: inv.from_email || "",
      to_client: inv.to_client,
      to_address: inv.to_address || "",
      to_email: inv.to_email || "",
      project_name: inv.project_name || "",
      status: inv.status,
      currency: inv.currency,
      tax_rate: Number(inv.tax_rate),
      notes: inv.notes || "",
      items: inv.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        total: Number(it.total),
      })),
    });
    setDialogOpen(true);
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }));
  };

  const handleSave = async () => {
    if (!form.from_company.trim() || !form.to_client.trim()) return;
    const validItems = form.items.filter((i) => i.description.trim());
    const payload = { ...form, items: validItems };
    if (editingId) {
      await update.mutateAsync({ id: editingId, input: payload });
    } else {
      await create.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const handleExport = async (id: string) => {
    const inv = await getInvoice(id);
    generateInvoicePdf(inv);
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            الفواتير
          </h1>
          <p className="text-muted-foreground mt-1">
            إصدار فواتير خدمات احترافية بالدولار وتصديرها PDF
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> فاتورة جديدة
        </Button>
      </div>

      <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
        {list.isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !list.data || list.data.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            لا توجد فواتير بعد. ابدأ بإنشاء أول فاتورة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-4 text-sm font-semibold">رقم الفاتورة</th>
                  <th className="text-right p-4 text-sm font-semibold">العميل</th>
                  <th className="text-right p-4 text-sm font-semibold">التاريخ</th>
                  <th className="text-right p-4 text-sm font-semibold">المبلغ</th>
                  <th className="text-right p-4 text-sm font-semibold">الحالة</th>
                  <th className="text-right p-4 text-sm font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((inv) => (
                  <tr key={inv.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-4 font-mono text-sm" dir="ltr">{inv.invoice_number}</td>
                    <td className="p-4">{inv.to_client}</td>
                    <td className="p-4 text-sm text-muted-foreground" dir="ltr">{inv.invoice_date}</td>
                    <td className="p-4 font-semibold" dir="ltr">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: inv.currency }).format(Number(inv.total_amount))}
                    </td>
                    <td className="p-4">
                      <Badge className={statusLabels[inv.status]?.color}>
                        {statusLabels[inv.status]?.label || inv.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleExport(inv.id)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(inv.id)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeleteId(inv.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل الفاتورة" : "فاتورة جديدة"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Invoice No</Label>
                <Input
                  dir="ltr"
                  value={form.invoice_number}
                  onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={form.due_date || ""}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                <h3 className="font-semibold">From</h3>
                <Input
                  placeholder="Company name *"
                  value={form.from_company}
                  onChange={(e) => setForm({ ...form, from_company: e.target.value })}
                />
                <Textarea
                  placeholder="Address"
                  rows={2}
                  value={form.from_address}
                  onChange={(e) => setForm({ ...form, from_address: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  dir="ltr"
                  value={form.from_email}
                  onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                />
              </div>
              <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                <h3 className="font-semibold">Bill To</h3>
                <Input
                  placeholder="Client name *"
                  value={form.to_client}
                  onChange={(e) => setForm({ ...form, to_client: e.target.value })}
                />
                <Textarea
                  placeholder="Address"
                  rows={2}
                  value={form.to_address}
                  onChange={(e) => setForm({ ...form, to_address: e.target.value })}
                />
                <Input
                  placeholder="Email"
                  dir="ltr"
                  value={form.to_email}
                  onChange={(e) => setForm({ ...form, to_email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Project / Reference</Label>
              <Input
                value={form.project_name}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                placeholder="e.g. Hisabaty System Deployment"
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({ ...form, items: [...form.items, { ...emptyItem }] })
                  }
                >
                  <Plus className="w-4 h-4" /> إضافة بند
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-6"
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit price"
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="col-span-1"
                      onClick={() =>
                        setForm({
                          ...form,
                          items: form.items.filter((_, i) => i !== idx),
                        })
                      }
                      disabled={form.items.length === 1}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>الحالة</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: InvoiceInput["status"]) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="sent">مرسلة</SelectItem>
                    <SelectItem value="paid">مدفوعة</SelectItem>
                    <SelectItem value="overdue">متأخرة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tax %</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-1 text-sm" dir="ltr">
              <div className="flex justify-between"><span>Subtotal:</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax ({form.tax_rate}%):</span><span>${taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                <span>Total Due:</span><span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={create.isPending || update.isPending || !form.from_company.trim() || !form.to_client.trim()}
            >
              {(create.isPending || update.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الفاتورة؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الفاتورة وكل بنودها نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) remove.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
