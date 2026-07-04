import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";

import { useBranchInventory } from "@/hooks/useBranchInventory";
import { useProducts } from "@/hooks/useProducts";

export default function Inventory() {
  const { branches } = useBranches();
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const { inventory, upsertInventory } = useBranchInventory(branchId);
  const { products } = useProducts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ product_id?: string; stock_quantity: number; custom_sale_price?: number; low_stock_threshold: number }>(
    { stock_quantity: 0, low_stock_threshold: 5 },
  );

  const branchOptions = useMemo(() => branches ?? [], [branches]);

  const save = async () => {
    if (!branchId || !form.product_id) return;
    await upsertInventory.mutateAsync({
      branch_id: branchId,
      product_id: form.product_id,
      stock_quantity: form.stock_quantity,
      custom_sale_price: form.custom_sale_price ?? null as any,
      low_stock_threshold: form.low_stock_threshold,
    });
    setOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">المخزون</h1>
            <p className="text-muted-foreground text-sm mt-1">إدارة المخزون على مستوى الفروع</p>
          </div>
          <div className="flex gap-2 items-end">
            <div className="w-48">
              <Label className="text-xs">الفرع</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="اختر فرع" /></SelectTrigger>
                <SelectContent>
                  {branchOptions.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={!branchId}><Plus className="w-4 h-4 ml-2" /> إضافة منتج</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>إضافة منتج للمخزون</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>المنتج</Label>
                    <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                      <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                      <SelectContent>
                        {products.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>الكمية</Label>
                      <Input type="number" value={form.stock_quantity}
                        onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label>حد التنبيه</Label>
                      <Input type="number" value={form.low_stock_threshold}
                        onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <Label>سعر بيع مخصص للفرع (اختياري)</Label>
                    <Input type="number" value={form.custom_sale_price ?? ""}
                      onChange={(e) => setForm({ ...form, custom_sale_price: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                  <Button onClick={save} disabled={!form.product_id || upsertInventory.isPending} className="w-full">حفظ</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المنتج</TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">الكمية</TableHead>
                  <TableHead className="text-right">سعر البيع</TableHead>
                  <TableHead className="text-right">حالة المخزون</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.data?.map((row) => {
                  const low = row.stock_quantity <= row.low_stock_threshold;
                  const price = row.custom_sale_price ?? row.product?.default_sale_price ?? 0;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.product?.product_name}</TableCell>
                      <TableCell className="font-mono text-xs">{row.product?.barcode || "—"}</TableCell>
                      <TableCell>{row.stock_quantity}</TableCell>
                      <TableCell>{price} ج.س</TableCell>
                      <TableCell>
                        {low ? (
                          <span className="inline-flex items-center gap-1 text-destructive text-sm">
                            <AlertTriangle className="w-4 h-4" /> منخفض
                          </span>
                        ) : (
                          <span className="text-emerald-600 text-sm">جيد</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!inventory.data?.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {branchId ? "لا يوجد مخزون بعد" : "اختر فرعاً لعرض المخزون"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
