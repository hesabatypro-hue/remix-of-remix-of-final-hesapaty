import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranches } from "@/hooks/useBranches";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  total_amount: number;
  payment_method: string;
  status: string;
  branch_id: string;
  created_at: string;
  notes: string | null;
}
interface ItemRow {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const statusLabels: Record<string, { text: string; variant: any }> = {
  confirmed: { text: "مؤكدة", variant: "default" },
  pending_image: { text: "بانتظار التحويل", variant: "outline" },
  cancelled: { text: "ملغاة", variant: "destructive" },
  ghost: { text: "شبح", variant: "secondary" },
};

const paymentLabels: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة",
};

export function POSInvoiceDialog({ invoiceId, open, onOpenChange }: Props) {
  const { currentOrganization } = useAuth();
  const { branches } = useBranches();
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);

  useEffect(() => {
    if (!invoiceId || !open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: inv }, { data: it }] = await Promise.all([
        supabase.from("pos_invoices").select("*").eq("id", invoiceId).maybeSingle(),
        supabase.from("pos_invoice_items").select("*").eq("invoice_id", invoiceId).order("created_at"),
      ]);
      if (cancelled) return;
      setInvoice(inv as any);
      setItems((it as any) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId, open]);

  const branchName = branches?.find((b: any) => b.id === invoice?.branch_id)?.name ?? "—";

  const downloadPdf = () => {
    if (!invoice) return;
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(currentOrganization?.name || "POS Invoice", 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice: ${invoice.invoice_number}`, 40, 60);
    doc.text(`Branch: ${branchName}`, 40, 74);
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleString()}`, 40, 88);
    doc.text(`Payment: ${paymentLabels[invoice.payment_method] || invoice.payment_method}`, 40, 102);
    doc.text(`Status: ${statusLabels[invoice.status]?.text || invoice.status}`, 40, 116);

    autoTable(doc, {
      startY: 130,
      head: [["#", "Item", "Qty", "Price", "Subtotal"]],
      body: items.map((r, i) => [
        i + 1,
        r.product_name,
        r.quantity,
        r.unit_price.toFixed(2),
        r.subtotal.toFixed(2),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 200;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total: ${invoice.total_amount.toFixed(2)} SDG`, 40, finalY + 24);

    doc.save(`${invoice.invoice_number}.pdf`);
  };

  const print = () => window.print();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg print:shadow-none">
        <DialogHeader>
          <DialogTitle>فاتورة نقطة البيع</DialogTitle>
        </DialogHeader>

        {loading || !invoice ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div id="pos-invoice-printable" className="space-y-4 text-sm">
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <p className="font-bold text-lg">{currentOrganization?.name}</p>
                <p className="text-muted-foreground text-xs">فرع: {branchName}</p>
              </div>
              <div className="text-left">
                <p className="font-mono text-xs">#{invoice.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(invoice.created_at).toLocaleString("ar-EG")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={statusLabels[invoice.status]?.variant || "outline"}>
                {statusLabels[invoice.status]?.text || invoice.status}
              </Badge>
              <Badge variant="secondary">{paymentLabels[invoice.payment_method]}</Badge>
            </div>

            <table className="w-full text-xs">
              <thead className="border-b">
                <tr className="text-right">
                  <th className="py-2">الصنف</th>
                  <th className="py-2 text-center">الكمية</th>
                  <th className="py-2 text-left">السعر</th>
                  <th className="py-2 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">{r.product_name}</td>
                    <td className="py-2 text-center">{r.quantity}</td>
                    <td className="py-2 text-left">{r.unit_price.toFixed(2)}</td>
                    <td className="py-2 text-left">{r.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center pt-3 border-t text-lg font-bold">
              <span>الإجمالي</span>
              <span>{invoice.total_amount.toFixed(2)} ج.س</span>
            </div>

            {invoice.status === "pending_image" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
                ⏳ بانتظار وصول إشعار التحويل عبر WhatsApp للتأكيد التلقائي.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 print:hidden">
          <Button variant="outline" onClick={print} disabled={!invoice}>
            <Printer className="w-4 h-4 ml-2" /> طباعة
          </Button>
          <Button onClick={downloadPdf} disabled={!invoice}>
            <Download className="w-4 h-4 ml-2" /> تنزيل PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
