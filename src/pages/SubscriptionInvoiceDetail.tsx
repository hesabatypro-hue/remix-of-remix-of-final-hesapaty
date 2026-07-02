import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Download, ArrowRight, FileText, Calendar, DollarSign, Building2, Mail, CreditCard, Hash, CheckCircle2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { usePlatformInvoices } from "@/hooks/usePlatformInvoices";
import { generatePlatformInvoicePdf } from "@/utils/platformInvoicePdf";

const statusVariant = (s: "issued" | "paid" | "void") =>
  s === "paid" ? "default" : s === "void" ? "secondary" : "outline";

const statusLabel = (s: "issued" | "paid" | "void") =>
  s === "paid" ? "مدفوعة" : s === "void" ? "ملغاة" : "صادرة";

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

const formatShortDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("ar-EG") : "—";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

export default function SubscriptionInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById } = usePlatformInvoices();
  const { data: inv, isLoading, error } = getById(id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-muted-foreground">جاري تحميل تفاصيل الفاتورة...</div>
      </DashboardLayout>
    );
  }

  if (error || !inv) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-muted-foreground space-y-4">
          <FileText className="h-12 w-12 mx-auto opacity-30" />
          <p>لم يتم العثور على الفاتورة.</p>
          <Button variant="outline" onClick={() => navigate("/subscription-invoices")}>
            <ArrowRight className="h-4 w-4 ml-2" />
            العودة للقائمة
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <span
                className="cursor-pointer hover:text-primary"
                onClick={() => navigate("/subscription-invoices")}
              >
                فواتير الاشتراك
              </span>
              <ArrowRight className="h-3 w-3" />
              <span>تفاصيل الفاتورة</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              {inv.invoice_number}
              <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => generatePlatformInvoicePdf(inv)}>
              <Download className="h-4 w-4 ml-2" />
              تنزيل PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 space-y-6">
            {/* From / To */}
            <Card>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* From */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>من / From</span>
                    </div>
                    <div>
                      <p className="font-bold text-lg">{inv.from_company}</p>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{inv.from_address}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Mail className="h-3 w-3" />
                        {inv.from_email}
                      </div>
                    </div>
                  </div>

                  {/* To */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Building2 className="h-4 w-4" />
                      <span>إلى / Bill To</span>
                    </div>
                    <div>
                      <p className="font-bold text-lg">{inv.to_organization_name}</p>
                      {inv.to_email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Mail className="h-3 w-3" />
                          {inv.to_email}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice line items */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  بيانات الفاتورة
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border rounded-lg overflow-hidden">
                    <thead className="bg-muted">
                      <tr className="text-right text-muted-foreground">
                        <th className="py-3 px-4 font-medium">البيان</th>
                        <th className="py-3 px-4 font-medium">الفترة</th>
                        <th className="py-3 px-4 font-medium text-center">الكمية</th>
                        <th className="py-3 px-4 font-medium">سعر الوحدة</th>
                        <th className="py-3 px-4 font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4">{inv.description || "Hisabaty Subscription"}</td>
                        <td className="py-3 px-4">
                          {inv.period_start && inv.period_end
                            ? `${formatShortDate(inv.period_start)} — ${formatShortDate(inv.period_end)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">1</td>
                        <td className="py-3 px-4">{fmt(inv.amount_usd)}</td>
                        <td className="py-3 px-4 font-semibold">{fmt(inv.amount_usd)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المجموع الفرعي</span>
                      <span>{fmt(inv.amount_usd)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">الضريبة</span>
                      <span>{fmt(inv.tax_usd)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>الإجمالي</span>
                      <span>{fmt(inv.total_usd)} USD</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment info */}
            {inv.status === "paid" && (
              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-lg">
                    <CheckCircle2 className="h-6 w-6" />
                    تم السداد
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">تاريخ الدفع</p>
                      <p className="font-semibold">{formatShortDate(inv.paid_at ? inv.paid_at.slice(0, 10) : null)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">مرجع الدفع</p>
                      <p className="font-semibold">{inv.payment_reference || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">طريقة الدفع</p>
                      <p className="font-semibold">{inv.payment_method || "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar meta */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-5">
                <h3 className="font-bold">معلومات الفاتورة</h3>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Hash className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">رقم الفاتورة</p>
                      <p className="font-semibold font-mono">{inv.invoice_number}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">تاريخ الإصدار</p>
                      <p className="font-semibold">{formatShortDate(inv.issue_date)}</p>
                    </div>
                  </div>
                  {inv.due_date && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">تاريخ الاستحقاق</p>
                        <p className="font-semibold">{formatShortDate(inv.due_date)}</p>
                      </div>
                    </div>
                  )}
                  {inv.period_start && inv.period_end && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-muted-foreground">فترة الخدمة</p>
                        <p className="font-semibold">
                          {formatShortDate(inv.period_start)} — {formatShortDate(inv.period_end)}
                        </p>
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">المبلغ</p>
                      <p className="font-semibold">{fmt(inv.amount_usd)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">الضريبة</p>
                      <p className="font-semibold">{fmt(inv.tax_usd)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">الإجمالي</p>
                      <p className="font-bold text-lg">{fmt(inv.total_usd)} USD</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">الحالة</p>
                      <Badge variant={statusVariant(inv.status)}>{statusLabel(inv.status)}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/40">
              <CardContent className="p-6 text-sm text-muted-foreground space-y-2">
                <p>هذه الفاتورة صادرة باسم Suda-Technologies LLC، شركة مسجلة في الولايات المتحدة.</p>
                <p>للاستفسارات: billing@suda-technologies.com</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
