import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/dashboard/StatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Receipt,
  Package,
  Boxes,
  AlertTriangle,
  Store,
  Clock,
  CheckCircle2,
  Calendar,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { usePOSStats } from "../hooks/usePOSStats";
import { usePOSInvoices } from "@/hooks/usePOSInvoices";
import { useState } from "react";
import { POSInvoiceDialog } from "@/components/pos/POSInvoiceDialog";
import { DashboardSkeleton } from "@/components/ui/page-skeleton";

export default function POSDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = usePOSStats();
  const { invoices } = usePOSInvoices();
  const [openId, setOpenId] = useState<string | null>(null);
  const today = format(new Date(), "EEEE، d MMMM yyyy", { locale: ar });

  if (isLoading) return <DashboardSkeleton />;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Calendar className="w-4 h-4" />
          <span>{today}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">لوحة نقطة البيع</h1>
          <Badge className="gap-1"><ShoppingCart className="w-3 h-3" /> POS</Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          مبيعات اليوم، حالة الفواتير، وتنبيهات المخزون — عرض مخصّص لموديول نقطة البيع فقط
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="إيرادات اليوم"
          value={`${(stats?.todayRevenue ?? 0).toLocaleString()} ج.س`}
          change={`${stats?.confirmedInvoices ?? 0} فاتورة مؤكدة`}
          changeType="positive"
          icon={Receipt}
          iconColor="primary"
        />
        <StatCard
          title="فواتير اليوم"
          value={String(stats?.todayInvoices ?? 0)}
          change={`${stats?.pendingInvoices ?? 0} بانتظار التأكيد`}
          changeType={stats?.pendingInvoices ? "negative" : "neutral"}
          icon={ShoppingCart}
          iconColor="accent"
        />
        <StatCard
          title="المنتجات"
          value={String(stats?.productsCount ?? 0)}
          change="في الكتالوج"
          changeType="neutral"
          icon={Package}
          iconColor="secondary"
        />
        <StatCard
          title="مخزون منخفض"
          value={String(stats?.lowStockCount ?? 0)}
          change="يحتاج إعادة تعبئة"
          changeType={stats?.lowStockCount ? "negative" : "positive"}
          icon={AlertTriangle}
          iconColor={stats?.lowStockCount ? "destructive" : "success"}
        />
      </div>

      {/* Actions + Recent invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1">
          <h3 className="text-lg font-bold mb-1">إجراءات سريعة</h3>
          <p className="text-sm text-muted-foreground mb-4">للوصول المباشر</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto flex-col p-4 gap-2" onClick={() => navigate("/pos")}>
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="text-right w-full">
                <p className="font-medium">فتح الكاشير</p>
                <p className="text-xs text-muted-foreground">بيع جديد</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4 gap-2" onClick={() => navigate("/products")}>
              <div className="w-10 h-10 rounded-xl gradient-secondary flex items-center justify-center">
                <Package className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div className="text-right w-full">
                <p className="font-medium">المنتجات</p>
                <p className="text-xs text-muted-foreground">إدارة الكتالوج</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4 gap-2" onClick={() => navigate("/inventory")}>
              <div className="w-10 h-10 rounded-xl bg-success flex items-center justify-center">
                <Boxes className="w-5 h-5 text-success-foreground" />
              </div>
              <div className="text-right w-full">
                <p className="font-medium">المخزون</p>
                <p className="text-xs text-muted-foreground">مستويات الفروع</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto flex-col p-4 gap-2" onClick={() => navigate("/branches")}>
              <div className="w-10 h-10 rounded-xl bg-warning flex items-center justify-center">
                <Store className="w-5 h-5 text-warning-foreground" />
              </div>
              <div className="text-right w-full">
                <p className="font-medium">الفروع</p>
                <p className="text-xs text-muted-foreground">{stats?.activeBranches ?? 0} نشط</p>
              </div>
            </Button>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5" /> آخر الفواتير
              </h3>
              <p className="text-sm text-muted-foreground">أحدث 10 فواتير من كل الفروع</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate("/pos")}>عرض الكل</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr className="text-right">
                  <th className="py-2">رقم الفاتورة</th>
                  <th className="py-2">التاريخ</th>
                  <th className="py-2">الحالة</th>
                  <th className="py-2 text-left">المبلغ</th>
                  <th className="py-2 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {(invoices.data ?? []).slice(0, 10).map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-muted/40">
                    <td className="py-2 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(inv.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2">
                      {inv.status === "confirmed" ? (
                        <Badge className="gap-1 text-xs"><CheckCircle2 className="w-3 h-3" /> مؤكدة</Badge>
                      ) : inv.status === "pending_image" ? (
                        <Badge variant="outline" className="gap-1 text-xs"><Clock className="w-3 h-3" /> بانتظار</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{inv.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 text-left font-semibold">{inv.total_amount.toFixed(2)}</td>
                    <td className="py-2 text-left">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(inv.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {(!invoices.data || invoices.data.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                      لا توجد فواتير بعد — ابدأ من <button className="text-primary underline" onClick={() => navigate("/pos")}>شاشة الكاشير</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <POSInvoiceDialog invoiceId={openId} open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} />
    </>
  );
}
