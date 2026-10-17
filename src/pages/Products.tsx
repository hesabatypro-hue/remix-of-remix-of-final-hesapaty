import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Barcode as BarcodeIcon } from "lucide-react";
import { useProducts, type Product } from "@/hooks/useProducts";

export default function Products() {
  const { products, upsertProduct, deleteProduct } = useProducts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const startNew = () => {
    setEditing({ product_name: "", barcode: "", cost_price: 0, default_sale_price: 0, category: "" });
    setOpen(true);
  };

  const startEdit = (p: Product) => {
    setEditing(p);
    setOpen(true);
  };

  const save = async () => {
    if (!editing?.product_name) return;
    await upsertProduct.mutateAsync(editing as any);
    setOpen(false);
    setEditing(null);
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">المنتجات</h1>
            <p className="text-muted-foreground text-sm mt-1">كتالوج المنتجات الموحّد للمؤسسة</p>
          </div>
          <Button onClick={startNew}>
            <Plus className="w-4 h-4 ml-2" /> منتج جديد
          </Button>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">التكلفة</TableHead>
                  <TableHead className="text-right">سعر البيع</TableHead>
                  <TableHead className="text-right">الفئة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.data?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        <BarcodeIcon className="w-3 h-3" />
                        {p.barcode || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{p.cost_price}</TableCell>
                    <TableCell>{p.default_sale_price} ج.س</TableCell>
                    <TableCell>{p.category || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteProduct.mutate(p.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!products.data?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      لا توجد منتجات بعد
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "تعديل منتج" : "منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم</Label>
              <Input
                value={editing?.product_name || ""}
                onChange={(e) => setEditing({ ...editing!, product_name: e.target.value })}
              />
            </div>
            <div>
              <Label>الباركود</Label>
              <Input
                value={editing?.barcode || ""}
                onChange={(e) => setEditing({ ...editing!, barcode: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>سعر التكلفة</Label>
                <Input
                  type="number"
                  value={editing?.cost_price ?? 0}
                  onChange={(e) => setEditing({ ...editing!, cost_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>سعر البيع</Label>
                <Input
                  type="number"
                  value={editing?.default_sale_price ?? 0}
                  onChange={(e) =>
                    setEditing({ ...editing!, default_sale_price: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div>
              <Label>الفئة</Label>
              <Input
                value={editing?.category || ""}
                onChange={(e) => setEditing({ ...editing!, category: e.target.value })}
              />
            </div>
            <Button onClick={save} disabled={upsertProduct.isPending} className="w-full">
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
