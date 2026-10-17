import { AlertTriangle, RefreshCw, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useWhatsAppConnections } from "@/hooks/useWhatsAppConnections";
import { Link } from "react-router-dom";

export function ConnectionAlert() {
  const { connections, isLoading } = useWhatsAppConnections();

  if (isLoading) return null;

  const disconnectedConnections = connections?.filter(
    (c) => c.status === "disconnected"
  );

  if (!disconnectedConnections || disconnectedConnections.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="font-bold">تنبيه: اتصال WhatsApp متوقف</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-2">
          {disconnectedConnections.length === 1
            ? "اتصال واتساب متوقف — لن يتم استقبال تحويلات جديدة من هذا الفرع حتى يتم إعادة الربط."
            : `${disconnectedConnections.length} اتصالات واتساب متوقفة — لن يتم استقبال تحويلات من الفروع المتوقفة.`}
        </p>
        <p className="text-xs opacity-80 mb-3">
          اذهب لإعدادات واتساب لإعادة الربط أو تحقق من حالة الاتصال.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/whatsapp">
              <Settings className="w-4 h-4 ml-2" />
              إعدادات WhatsApp
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
