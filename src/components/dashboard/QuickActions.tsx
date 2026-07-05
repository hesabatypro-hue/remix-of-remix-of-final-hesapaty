import { Plus, FileDown, MessageCircle, Calculator, ShoppingCart, Package, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Action = {
  icon: any;
  label: string;
  description: string;
  color: "primary" | "secondary" | "success" | "warning";
  path: string;
};

const baseActions: Action[] = [
  { icon: Plus, label: "إضافة تحويل", description: "تسجيل تحويل يدوي", color: "primary", path: "/transfers" },
  { icon: FileDown, label: "تصدير التقرير", description: "تقرير اليوم PDF", color: "secondary", path: "/reports" },
  { icon: MessageCircle, label: "فتح واتساب", description: "عرض المحادثات", color: "success", path: "/whatsapp" },
  { icon: Calculator, label: "حساب الإيراد", description: "إغلاق اليوم", color: "warning", path: "/financial-reports" },
];

const posActions: Action[] = [
  { icon: ShoppingCart, label: "نقطة البيع", description: "فتح شاشة الكاشير", color: "primary", path: "/pos" },
  { icon: Package, label: "المنتجات", description: "إدارة الكتالوج", color: "secondary", path: "/products" },
  { icon: Boxes, label: "المخزون", description: "مستويات المخزون", color: "success", path: "/inventory" },
  { icon: FileDown, label: "تقارير الإيرادات", description: "المبيعات والتحويلات", color: "warning", path: "/reports" },
];

export function QuickActions() {
  const navigate = useNavigate();
  const { currentOrganization } = useAuth();
  const posEnabled = (currentOrganization as any)?.is_pos_enabled === true;
  const actions = posEnabled ? posActions : baseActions;

  return (
    <div className="bg-card rounded-2xl shadow-soft border border-border/50 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground">إجراءات سريعة</h3>
        <p className="text-sm text-muted-foreground">العمليات الأكثر استخداماً</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action, index) => (
          <Button
            key={action.label}
            variant="glass"
            onClick={() => navigate(action.path)}
            className="h-auto flex-col items-start p-4 gap-2 animate-scale-in cursor-pointer"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                action.color === "primary"
                  ? "gradient-primary"
                  : action.color === "secondary"
                  ? "gradient-secondary"
                  : action.color === "success"
                  ? "bg-success"
                  : "bg-warning"
              }`}
            >
              <action.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="text-right">
              <p className="font-medium text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
