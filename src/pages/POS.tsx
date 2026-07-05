import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Barcode, Trash2, Plus, Minus, ShoppingCart, Wallet, CreditCard, Banknote } from "lucide-react";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/contexts/AuthContext";
import { useProductByBarcode, useProducts } from "@/hooks/useProducts";
import { useBranchInventory } from "@/hooks/useBranchInventory";
import { usePOSInvoices, type POSInvoiceItemInput } from "@/hooks/usePOSInvoices";
import { useToast } from "@/hooks/use-toast";

interface CartLine {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export default function POS() {
  const { toast } = useToast();
  const { branches } = useBranches();
  const { userRoles, currentOrganization } = useAuth();
  const currentRole = userRoles.find((r) => r.organization_id === currentOrganization?.id);
  const [branchId, setBranchId] = useState<string | undefined>(
    currentRole?.branch_id ?? undefined,
  );
  const { inventory } = useBranchInventory(branchId);
  const { products } = useProducts();
  const { createInvoice, queueSize, flushQueue } = usePOSInvoices(branchId);
  const findByBarcode = useProductByBarcode();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [barcode, setBarcode] = useState("");
  const [payment, setPayment] = useState<"cash" | "bank_transfer" | "card">("cash");
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Keep barcode input focused (laser scanner acts as keyboard)
  useEffect(() => {
    const focus = () => barcodeRef.current?.focus();
    focus();
    const onBlur = () => setTimeout(focus, 100);
    window.addEventListener("click", focus);
    barcodeRef.current?.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("click", focus);
    };
  }, []);

  const branchOptions = useMemo(() => branches ?? [], [branches]);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unit_price, 0),
    [cart],
  );

  const addToCart = (line: CartLine) => {
    setCart((c) => {
      const idx = c.findIndex((l) => l.product_id === line.product_id && l.product_id !== null);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + line.quantity };
        return next;
      }
      return [...c, line];
    });
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const p = await findByBarcode(code);
    if (!p) {
      toast({ title: "منتج غير موجود", description: code, variant: "destructive" });
    } else {
      const invRow = inventory.data?.find((r) => r.product_id === p.id);
      const price = invRow?.custom_sale_price ?? p.default_sale_price;
      addToCart({
        product_id: p.id,
        product_name: p.product_name,
        quantity: 1,
        unit_price: price,
      });
    }
    setBarcode("");
    barcodeRef.current?.focus();
  };

  const addManual = (productId: string) => {
    const p = products.data?.find((x) => x.id === productId);
    if (!p) return;
    const invRow = inventory.data?.find((r) => r.product_id === p.id);
    const price = invRow?.custom_sale_price ?? p.default_sale_price;
    addToCart({ product_id: p.id, product_name: p.product_name, quantity: 1, unit_price: price });
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((c) => {
      const next = [...c];
      next[idx] = { ...next[idx], quantity: Math.max(1, next[idx].quantity + delta) };
      return next;
    });
  };

  const removeLine = (idx: number) => setCart((c) => c.filter((_, i) => i !== idx));

  const checkout = async () => {
    if (!branchId || cart.length === 0) return;
    const items: POSInvoiceItemInput[] = cart.map((l) => ({
      product_id: l.product_id,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      subtotal: l.quantity * l.unit_price,
    }));
    await createInvoice.mutateAsync({
      branch_id: branchId,
      total_amount: total,
      payment_method: payment,
      items,
    });
    setCart([]);
    setPayment("cash");
    barcodeRef.current?.focus();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-6 h-6" /> نقطة البيع
            </h1>
            <p className="text-muted-foreground text-sm mt-1">امسح الباركود أو اختر منتجاً وأتمم البيع</p>
          </div>
          {!currentRole?.branch_id && (
            <div className="w-56">
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
          )}
        </div>

        {!branchId ? (
          <Card className="p-8 text-center text-muted-foreground">
            اختر فرعاً للبدء
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: barcode + product picker */}
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Barcode className="w-4 h-4" /> مسح الباركود
              </h3>
              <form onSubmit={handleBarcodeSubmit}>
                <Input
                  ref={barcodeRef}
                  autoFocus
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="امسح أو أدخل الباركود..."
                  className="font-mono"
                />
              </form>

              <div className="pt-3 border-t">
                <Label className="text-xs mb-2 block">أو اختر يدوياً</Label>
                <Select onValueChange={addManual}>
                  <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                  <SelectContent>
                    {products.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Middle: cart */}
            <Card className="p-4 lg:col-span-1">
              <h3 className="font-semibold mb-3">السلة ({cart.length})</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {cart.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">السلة فارغة</p>
                )}
                {cart.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{l.product_name}</p>
                      <p className="text-xs text-muted-foreground">{l.unit_price} ج.س</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => updateQty(i, -1)}>
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{l.quantity}</span>
                      <Button size="icon" variant="ghost" onClick={() => updateQty(i, 1)}>
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeLine(i)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Right: payment */}
            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">الدفع</h3>
              <div className="text-3xl font-bold text-center py-4 bg-muted rounded-xl">
                {total.toFixed(2)} <span className="text-lg text-muted-foreground">ج.س</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={payment === "cash" ? "default" : "outline"}
                  onClick={() => setPayment("cash")}
                  className="flex-col h-16"
                >
                  <Banknote className="w-4 h-4" /> نقدي
                </Button>
                <Button
                  variant={payment === "bank_transfer" ? "default" : "outline"}
                  onClick={() => setPayment("bank_transfer")}
                  className="flex-col h-16"
                >
                  <Wallet className="w-4 h-4" /> تحويل
                </Button>
                <Button
                  variant={payment === "card" ? "default" : "outline"}
                  onClick={() => setPayment("card")}
                  className="flex-col h-16"
                >
                  <CreditCard className="w-4 h-4" /> بطاقة
                </Button>
              </div>
              {payment === "bank_transfer" && (
                <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  ⏳ ستُنشأ فاتورة بحالة <Badge variant="outline">بانتظار التحويل</Badge> — ستتأكد تلقائياً عند وصول إشعار WhatsApp بنفس المبلغ خلال 15 دقيقة.
                </div>
              )}
              <Button
                className="w-full h-12 text-lg"
                onClick={checkout}
                disabled={cart.length === 0 || createInvoice.isPending}
              >
                إتمام البيع
              </Button>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
