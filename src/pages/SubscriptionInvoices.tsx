import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, CheckCircle2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlatformInvoices, type PlatformInvoice } from "@/hooks/usePlatformInvoices";
import { generatePlatformInvoicePdf } from "@/utils/platformInvoicePdf";

const statusVariant = (s: PlatformInvoice["status"]) =>
  s === "paid" ? "default" : s === "void" ? "secondary" : "outline";

const statusLabel = (s: PlatformInvoice["status"]) =>
  s === "paid" ? "مدفوعة" : s === "void" ? "ملغاة" : "صادرة";

export default function SubscriptionInvoices() {
  const { list, markPaid } = usePlatformInvoices();
  const navigate = useNavigate();
  const invoices = list.data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">فواتير الاشتراك</h1>
            <p className="text-sm text-muted-foreground mt-1">
              فواتير اشتراكاتك في حساباتي صادرة باسم Suda-Technologies LLC بصيغة معتمدة بنكياً
            </p>
          </div>
          <FileSpreadsheet className="h-10 w-10 text-primary opacity-60" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>السجل ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {list.isLoading ? (
              <p className="text-muted-foreground py-8 text-center">جاري التحميل...</p>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground space-y-2">
                <FileSpreadsheet className="h-12 w-12 mx-auto opacity-30" />
                <p>لا توجد فواتير اشتراك بعد.</p>
                <p className="text-xs">تُصدر الفواتير تلقائياً عند ترقية الخطة من تبويب المؤسسة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-right text-muted-foreground">
                      <th className="py-3 px-2 font-medium">رقم الفاتورة</th>
                      <th className="py-3 px-2 font-medium">التاريخ</th>
                      <th className="py-3 px-2 font-medium">الوصف</th>
                      <th className="py-3 px-2 font-medium">المبلغ</th>
                      <th className="py-3 px-2 font-medium">الحالة</th>
                      <th className="py-3 px-2 font-medium text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-muted/40">
                        <td className="py-3 px-2">
                          <button
                            onClick={() => navigate(`/subscription-invoices/${inv.id}`)}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {inv.invoice_number}
                          </button>
                        </td>
                        <td className="py-3 px-2">
                          {new Date(inv.issue_date).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="py-3 px-2">{inv.description}</td>
                        <td className="py-3 px-2 font-semibold">${Number(inv.total_usd).toFixed(2)}</td>
                        <td className="py-3 px-2">
                          <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/subscription-invoices/${inv.id}`)}
                              title="عرض التفاصيل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generatePlatformInvoicePdf(inv)}
                            >
                              <Download className="h-4 w-4 ml-1" />
                              PDF
                            </Button>
                            {inv.status === "issued" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  markPaid.mutate({ id: inv.id, method: "bank_transfer" })
                                }
                                disabled={markPaid.isPending}
                              >
                                <CheckCircle2 className="h-4 w-4 ml-1" />
                                تأكيد الدفع
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
