import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

type Factor = { id: string; status: string; friendly_name?: string };

export function TwoFactorSection() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [verifiedFactor, setVerifiedFactor] = useState<Factor | null>(null);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qr: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return;
    const totp = (data?.totp ?? []) as Factor[];
    const verified = totp.find((f) => f.status === "verified");
    setVerifiedFactor(verified ?? null);
    // Cleanup stale unverified factors silently
    const stale = totp.filter((f) => f.status !== "verified");
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const startEnroll = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Hisabati-${Date.now()}`,
    });
    setBusy(false);
    if (error || !data) {
      toast({ title: "خطأ", description: error?.message || "فشل البدء", variant: "destructive" });
      return;
    }
    setEnrollment({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  };

  const verifyEnroll = async () => {
    if (!enrollment || code.length < 6) return;
    setBusy(true);
    const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    });
    if (chalErr || !chal) {
      setBusy(false);
      toast({ title: "خطأ", description: chalErr?.message || "فشل التحقق", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: chal.id,
      code,
    });
    setBusy(false);
    if (error) {
      toast({ title: "رمز غير صحيح", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم التفعيل", description: "تم تفعيل المصادقة الثنائية بنجاح" });
    setEnrollment(null);
    setCode("");
    refresh();
  };

  const cancelEnroll = async () => {
    if (!enrollment) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
  };

  const disable = async () => {
    if (!verifiedFactor) return;
    if (!confirm("هل أنت متأكد من إلغاء المصادقة الثنائية؟")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
    setBusy(false);
    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم الإلغاء", description: "تم إلغاء المصادقة الثنائية" });
    refresh();
  };

  return (
    <div className="bg-card rounded-2xl shadow-soft border border-border/50 overflow-hidden">
      <div className="p-5 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">المصادقة الثنائية (2FA)</h2>
          <p className="text-sm text-muted-foreground">طبقة حماية إضافية لحسابك</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : verifiedFactor ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <ShieldCheck className="w-5 h-5" />
              <span className="font-medium">المصادقة الثنائية مفعّلة</span>
            </div>
            <p className="text-sm text-muted-foreground">
              يُطلب منك إدخال رمز من تطبيق المصادقة عند كل تسجيل دخول.
            </p>
            <Button variant="outline" size="sm" onClick={disable} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              إلغاء التفعيل
            </Button>
          </div>
        ) : enrollment ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              امسح رمز QR في تطبيق Google Authenticator أو Authy، ثم أدخل الرمز للتأكيد.
            </p>
            <div className="flex justify-center bg-white p-3 rounded-xl">
              <img src={enrollment.qr} alt="QR Code" className="w-44 h-44" />
            </div>
            <div className="text-xs text-center text-muted-foreground" dir="ltr">
              <span className="font-mono select-all">{enrollment.secret}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="totp-code">رمز التحقق المكوّن من 6 أرقام</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                dir="ltr"
                className="text-center text-lg tracking-widest"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={busy || code.length < 6} className="flex-1">
                {busy && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                تأكيد التفعيل
              </Button>
              <Button variant="outline" onClick={cancelEnroll} disabled={busy}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-sm">المصادقة الثنائية غير مفعّلة</span>
            </div>
            <p className="text-sm text-muted-foreground">
              فعّل المصادقة الثنائية لحماية حسابك من الوصول غير المصرّح به.
            </p>
            <Button onClick={startEnroll} disabled={busy} className="w-full sm:w-auto">
              {busy && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              تفعيل المصادقة الثنائية
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
