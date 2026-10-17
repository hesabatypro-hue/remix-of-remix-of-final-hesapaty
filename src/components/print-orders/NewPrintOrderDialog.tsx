import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import type { PrintOrderInsert } from "@/hooks/usePrintOrders";

const materialTypes = [
  { value: "banner", label: "بنر" },
  { value: "sticker", label: "ستيكر" },
  { value: "flex", label: "فليكس" },
  { value: "vinyl", label: "فينيل" },
  { value: "canvas", label: "كانفس" },
  { value: "other", label: "أخرى" },
];

interface Props {
  orgId: string;
  branches: { id: string; name: string }[];
  employees: { id: string; full_name: string }[];
  onSubmit: (order: PrintOrderInsert) => void;
  isLoading: boolean;
}

export function NewPrintOrderDialog({ orgId, branches, employees, onSubmit, isLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    material_type: "banner",
    width: "",
    height: "",
    quantity: "1",
    unit_price: "",
    commission_rate: "0",
    file_path: "",
    designer_id: "",
    printer_id: "",
    branch_id: "",
    notes: "",
  });

  const handleSubmit = () => {
    if (!form.customer_name || !form.width || !form.height || !form.unit_price) return;
    onSubmit({
      organization_id: orgId,
      customer_name: form.customer_name,
      material_type: form.material_type,
      width: parseFloat(form.width),
      height: parseFloat(form.height),
      quantity: parseInt(form.quantity) || 1,
      unit_price: parseFloat(form.unit_price),
      commission_rate: parseFloat(form.commission_rate) || 0,
      file_path: form.file_path || null,
      designer_id: form.designer_id || null,
      printer_id: form.printer_id || null,
      branch_id: form.branch_id || null,
      notes: form.notes || null,
    });
    setForm({
      customer_name: "", material_type: "banner", width: "", height: "",
      quantity: "1", unit_price: "", commission_rate: "0", file_path: "",
      designer_id: "", printer_id: "", branch_id: "", notes: "",
    });
    setOpen(false);
  };

  const area = (parseFloat(form.width) || 0) * (parseFloat(form.height) || 0) * (parseInt(form.quantity) || 1);
  const totalPrice = area * (parseFloat(form.unit_price) || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 ml-2" />أمر تشغيل جديد</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء أمر تشغيل جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Customer */}
          <div>
            <Label>اسم الزبون *</Label>
            <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="اسم الزبون" />
          </div>

          {/* Material & Branch */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>نوع الخام</Label>
              <Select value={form.material_type} onValueChange={v => setForm(f => ({ ...f, material_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {materialTypes.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الفرع</Label>
              <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>العرض (م) *</Label>
              <Input type="number" min="0" step="0.01" value={form.width} onChange={e => setForm(f => ({ ...f, width: e.target.value }))} />
            </div>
            <div>
              <Label>الارتفاع (م) *</Label>
              <Input type="number" min="0" step="0.01" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} />
            </div>
            <div>
              <Label>الكمية</Label>
              <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>سعر المتر² (ر.س) *</Label>
              <Input type="number" min="0" step="0.5" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
            </div>
            <div>
              <Label>معدل العمولة / م²</Label>
              <Input type="number" min="0" step="0.1" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} />
            </div>
          </div>

          {/* Calculated summary */}
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>المساحة الكلية:</span><span className="font-medium">{area.toFixed(2)} م²</span></div>
            <div className="flex justify-between"><span>السعر الكلي:</span><span className="font-bold text-primary">{totalPrice.toFixed(2)} ر.س</span></div>
          </div>

          {/* Employees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>المصمم</Label>
              <Select value={form.designer_id} onValueChange={v => setForm(f => ({ ...f, designer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المصمم" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>فني الطباعة</Label>
              <Select value={form.printer_id} onValueChange={v => setForm(f => ({ ...f, printer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الفني" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File path */}
          <div>
            <Label>مسار الملف</Label>
            <Input value={form.file_path} onChange={e => setForm(f => ({ ...f, file_path: e.target.value }))} placeholder="مثال: D:\designs\order123.pdf" dir="ltr" />
          </div>

          {/* Notes */}
          <div>
            <Label>ملاحظات</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="ملاحظات إضافية..." />
          </div>

          <Button onClick={handleSubmit} disabled={isLoading || !form.customer_name || !form.width || !form.height || !form.unit_price} className="w-full">
            {isLoading ? "جاري الإنشاء..." : "إنشاء أمر التشغيل"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
