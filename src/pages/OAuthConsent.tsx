import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthOAuth = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function getOAuth(): AuthOAuth {
  // Beta namespace; not always in the SDK's public types.
  return (supabase.auth as unknown as { oauth: AuthOAuth }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const oauth = getOAuth();
      if (!oauth?.getAuthorizationDetails) {
        return setError("OAuth server helpers are unavailable.");
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message || String(error));
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauth = getOAuth();
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message || String(error));
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("لم يُرجع خادم التفويض عنوان إعادة توجيه.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold">تعذّر تحميل طلب التفويض</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-muted-foreground">جاري التحميل…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "تطبيق خارجي";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-5 shadow-soft">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">ربط {clientName} بحسابك</h1>
          <p className="text-sm text-muted-foreground">
            سيتمكن <strong>{clientName}</strong> من استخدام أدوات هذا التطبيق نيابةً عنك ما دمت مسجّل الدخول.
          </p>
        </div>

        <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">الوصول:</span>
            <span>قراءة الفروع والتحويلات وملخصات الإيرادات</span>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
            لا يتجاوز هذا صلاحيات RLS: البيانات المتاحة هي فقط ما يمكنك أنت الوصول إليه.
          </p>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy ? "…" : "الموافقة والربط"}
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            رفض
          </Button>
        </div>
      </div>
    </main>
  );
}
