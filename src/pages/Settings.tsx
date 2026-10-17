import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoginHistorySection } from "@/components/settings/LoginHistorySection";
import { TwoFactorSection } from "@/components/settings/TwoFactorSection";

export default function Settings() {
  const { profile, currentOrganization } = useAuth();
  const { preferences, isLoading: prefsLoading, updatePreferences } = useUserPreferences();
  const { setTheme } = useTheme();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleToggle = (key: string, value: boolean) => {
    updatePreferences.mutate({ [key]: value });
    if (key === "dark_mode") {
      setTheme(value ? "dark" : "light");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "خطأ", description: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "خطأ", description: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم التحديث", description: "تم تغيير كلمة المرور بنجاح" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">الإعدادات</h1>
        <p className="text-muted-foreground mt-1">تخصيص النظام وإدارة الأمان والإشعارات</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Company Info */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">معلومات الشركة</h2>
                <p className="text-sm text-muted-foreground">تعديل معلومات الشركة الأساسية</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم الشركة</Label>
                  <p className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2">{currentOrganization?.name || "-"}</p>
                  <p className="text-xs text-muted-foreground">يمكنك تعديل اسم الشركة من صفحة إعدادات المؤسسة</p>
                </div>
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <p className="text-sm text-foreground bg-muted/50 rounded-md px-3 py-2" dir="ltr">{profile?.email || "-"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">الإشعارات</h2>
                <p className="text-sm text-muted-foreground">إدارة إعدادات الإشعارات</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">إشعارات التطبيق</p>
                  <p className="text-sm text-muted-foreground">استلام إشعارات داخل التطبيق</p>
                </div>
                <Switch
                  checked={preferences.notifications_enabled}
                  onCheckedChange={(v) => handleToggle("notifications_enabled", v)}
                  disabled={prefsLoading}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">تنبيهات البريد</p>
                  <p className="text-sm text-muted-foreground">استلام تنبيهات عبر البريد الإلكتروني</p>
                </div>
                <Switch
                  checked={preferences.email_alerts_enabled}
                  onCheckedChange={(v) => handleToggle("email_alerts_enabled", v)}
                  disabled={prefsLoading}
                />
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">الأمان</h2>
                <p className="text-sm text-muted-foreground">إعدادات الأمان وكلمة المرور</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                  <Input id="new-password" type="password" className="bg-muted/50" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                  <Input id="confirm-password" type="password" className="bg-muted/50" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" className="w-full sm:w-auto gap-2" onClick={handleChangePassword} disabled={changingPassword}>
                {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                تغيير كلمة المرور
              </Button>
            </div>
          </div>

          {/* Two-Factor Authentication */}
          <TwoFactorSection />
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          {/* Appearance */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Palette className="w-5 h-5 text-primary" />
              </div>
              <div><h2 className="font-bold text-foreground">المظهر</h2></div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">الوضع الداكن</p>
                  <p className="text-sm text-muted-foreground">تفعيل الوضع الليلي</p>
                </div>
                <Switch
                  checked={preferences.dark_mode}
                  onCheckedChange={(v) => handleToggle("dark_mode", v)}
                  disabled={prefsLoading}
                />
              </div>
            </div>
          </div>

          {/* Language */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-success" />
              </div>
              <div><h2 className="font-bold text-foreground">اللغة</h2></div>
            </div>
            <div className="p-5">
              <p className="text-sm text-muted-foreground mb-3">اللغة الحالية</p>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
                <span className="text-lg">🇸🇦</span>
                <span className="font-medium text-foreground">العربية</span>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-success" />
              </div>
              <div><h2 className="font-bold text-foreground">واتساب</h2></div>
            </div>
            <div className="p-5 space-y-2">
              <p className="text-sm text-muted-foreground mb-3">إدارة اتصالات واتساب للفروع</p>
              <Button variant="outline" className="w-full" onClick={() => (window.location.href = "/whatsapp")}>
                إعدادات واتساب
              </Button>
              <Button variant="outline" className="w-full" onClick={() => (window.location.href = "/whatsapp-confirmation-log")}>
                سجل رسائل التأكيد
              </Button>
            </div>
          </div>

          {/* Login History */}
          <LoginHistorySection />
        </div>
      </div>
    </DashboardLayout>
  );
}
