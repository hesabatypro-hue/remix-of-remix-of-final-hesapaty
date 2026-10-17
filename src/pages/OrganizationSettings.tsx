import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Building2,
  Camera,
  Save,
  Loader2,
  Crown,
  Users,
  Store,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Printer,
  TrendingUp,
  FileSpreadsheet,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrganizationLimits } from "@/hooks/useOrganizationLimits";
import { useToast } from "@/hooks/use-toast";
import { useActiveModule } from "@/modules/ActiveModuleProvider";
import { useNavigate } from "react-router-dom";

const planLabels: Record<string, string> = {
  free: "المجانية",
  starter: "المبتدئة",
  professional: "الاحترافية",
  enterprise: "المؤسسات",
};

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-primary/10 text-primary",
  professional: "bg-warning/10 text-warning",
  enterprise: "bg-success/10 text-success",
};

export default function OrganizationSettings() {
  const { currentOrganization } = useAuth();
  const { updateOrganization, uploadLogo } = useOrganization();
  const { limits, isLoading: limitsLoading } = useOrganizationLimits();
  const { toast } = useToast();
  const { switchModule } = useActiveModule();
  const navigate = useNavigate();

  const [name, setName] = useState(currentOrganization?.name || "");
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف صورة صالح",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "خطأ",
        description: "حجم الصورة يجب أن يكون أقل من 2 ميجابايت",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    try {
      const logoUrl = await uploadLogo(file);
      if (logoUrl) {
        await updateOrganization.mutateAsync({ logo_url: logoUrl });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    await updateOrganization.mutateAsync({ name: name.trim() });
  };

  const branchPercentage = limits ? (limits.current_branches / limits.max_branches) * 100 : 0;
  const userPercentage = limits ? (limits.current_users / limits.max_users) * 100 : 0;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-warning";
    return "bg-primary";
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">إعدادات المؤسسة</h1>
        <p className="text-muted-foreground mt-1">
          إدارة بيانات المؤسسة والخطة الحالية
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization Info */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">معلومات المؤسسة</h2>
                <p className="text-sm text-muted-foreground">
                  تعديل اسم وشعار المؤسسة
                </p>
              </div>
            </div>
            <div className="p-5 space-y-6">
              {/* Logo Upload */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div
                    className={cn(
                      "w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden",
                      "bg-muted border-2 border-dashed border-border",
                      "transition-all duration-200 group-hover:border-primary"
                    )}
                  >
                    {previewUrl || currentOrganization?.logo_url ? (
                      <img
                        src={previewUrl || currentOrganization?.logo_url || ''}
                        alt="شعار المؤسسة"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-10 h-10 text-muted-foreground" />
                    )}
                    {isUploading && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={cn(
                      "absolute -bottom-2 -right-2 w-8 h-8 rounded-full",
                      "bg-primary text-primary-foreground shadow-lg",
                      "flex items-center justify-center",
                      "hover:bg-primary/90 transition-colors",
                      "disabled:opacity-50"
                    )}
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground">شعار المؤسسة</p>
                  <p className="text-sm text-muted-foreground">
                    اضغط على الأيقونة لتغيير الشعار
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    الحد الأقصى: 2 ميجابايت (PNG, JPG)
                  </p>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="org-name">اسم المؤسسة</Label>
                <div className="flex gap-3">
                  <Input
                    id="org-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="أدخل اسم المؤسسة"
                    className="bg-muted/50"
                  />
                  <Button
                    onClick={handleSaveName}
                    disabled={updateOrganization.isPending || !name.trim() || name === currentOrganization?.name}
                    className="gap-2 shrink-0"
                  >
                    {updateOrganization.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    حفظ
                  </Button>
                </div>
              </div>

              {/* Organization ID */}
              <div className="space-y-2">
                <Label>معرّف المؤسسة</Label>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <code className="text-sm text-muted-foreground" dir="ltr">
                    {currentOrganization?.id || '-'}
                  </code>
                </div>
              </div>

              {/* Industry Type */}
              <div className="space-y-2">
                <Label>نوع النشاط</Label>
                <div className="flex gap-3">
                  <Select
                    value={currentOrganization?.industry_type || 'general'}
                    onValueChange={(value) => {
                      updateOrganization.mutate({ industry_type: value });
                    }}
                  >
                    <SelectTrigger className="bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>عام</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="printing">
                        <div className="flex items-center gap-2">
                          <Printer className="w-4 h-4" />
                          <span>مطابع</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  اختيار "مطابع" سيُظهر أدوات إدارة أوامر التشغيل والمخزون
                </p>
              </div>

              {/* Investment Module Toggle */}
              <div className="space-y-2">
                <Label>مديول الاستثمار والائتمان</Label>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm">تفعيل أدوات الاستثمار وإدارة الائتمان</span>
                  </div>
                  <Switch
                    checked={!!currentOrganization?.investment_enabled}
                    onCheckedChange={(checked) => {
                      updateOrganization.mutate({ investment_enabled: checked });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  عند التفعيل سيظهر تبويب "الاستثمار والائتمان" في القائمة الجانبية
                </p>
              </div>

              {/* Invoicing Module Toggle */}
              <div className="space-y-2">
                <Label>مديول الفواتير</Label>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    <span className="text-sm">تفعيل إصدار فواتير الخدمات (USD)</span>
                  </div>
                  <Switch
                    checked={!!currentOrganization?.invoicing_enabled}
                    onCheckedChange={(checked) => {
                      updateOrganization.mutate({ invoicing_enabled: checked });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  عند التفعيل سيظهر تبويب "الفواتير" لإصدار فواتير احترافية وتصديرها PDF
                </p>
              </div>

              {/* POS Module Toggle */}
              <div className="space-y-2">
                <Label>مديول نقطة البيع (POS)</Label>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    <span className="text-sm">تفعيل نقطة البيع والمنتجات والمخزون</span>
                  </div>
                  <Switch
                    checked={!!(currentOrganization as any)?.is_pos_enabled}
                    onCheckedChange={async (checked) => {
                      await updateOrganization.mutateAsync({ is_pos_enabled: checked } as any);
                      if (checked) {
                        switchModule("POS_INVENTORY");
                        toast({
                          title: "تم تفعيل نقطة البيع",
                          description: "تم التبديل إلى واجهة موديول POS المخصّصة",
                        });
                        navigate("/dashboard");
                      } else {
                        switchModule("REVENUE_TRACKER");
                        toast({ title: "تم إيقاف نقطة البيع", description: "العودة إلى متعقّب الإيرادات" });
                        navigate("/dashboard");
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  عند التفعيل ستظهر تبويبات "نقطة البيع" و"المنتجات" و"المخزون"، وسيتم إخفاء تبويب "التحويلات" لصالح مطابقتها التلقائية بفواتير POS
                </p>
              </div>
            </div>
          </div>


          {/* Usage Stats */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">استخدام الخطة</h2>
                <p className="text-sm text-muted-foreground">
                  تفاصيل استخدامك الحالي
                </p>
              </div>
            </div>
            <div className="p-5 space-y-6">
              {limitsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : limits ? (
                <>
                  {/* Branches Usage */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium text-foreground">الفروع</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {branchPercentage >= 100 ? (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-success" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {limits.current_branches} / {limits.max_branches}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress value={Math.min(branchPercentage, 100)} className="h-2" />
                      <div
                        className={cn(
                          "absolute top-0 left-0 h-2 rounded-full transition-all",
                          getProgressColor(branchPercentage)
                        )}
                        style={{ width: `${Math.min(branchPercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Users Usage */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-muted-foreground" />
                        <span className="font-medium text-foreground">المستخدمين</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {userPercentage >= 100 ? (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-success" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {limits.current_users} / {limits.max_users}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress value={Math.min(userPercentage, 100)} className="h-2" />
                      <div
                        className={cn(
                          "absolute top-0 left-0 h-2 rounded-full transition-all",
                          getProgressColor(userPercentage)
                        )}
                        style={{ width: `${Math.min(userPercentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  لا توجد بيانات متاحة
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-bold text-foreground">الخطة الحالية</h2>
            </div>
            <div className="p-5">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Crown className="w-8 h-8 text-primary-foreground" />
                </div>
                <div
                  className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                    planColors[limits?.plan_type || 'free']
                  )}
                >
                  الخطة {planLabels[limits?.plan_type || 'free']}
                </div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">الفروع</span>
                  <span className="font-medium text-foreground">
                    حتى {limits?.max_branches || 0} فروع
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-muted-foreground">المستخدمين</span>
                  <span className="font-medium text-foreground">
                    حتى {limits?.max_users || 0} مستخدمين
                  </span>
                </div>
              </div>

              <Button className="w-full mt-4 gap-2">
                <Sparkles className="w-4 h-4" />
                ترقية الخطة
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-bold text-foreground">معلومات سريعة</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">تاريخ الإنشاء</span>
                <span className="font-medium text-foreground">
                  {currentOrganization?.created_at
                    ? new Date(currentOrganization.created_at).toLocaleDateString('ar-SA')
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">حالة الاشتراك</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                  {currentOrganization?.subscription_status === 'active' ? 'نشط' : 'غير نشط'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
