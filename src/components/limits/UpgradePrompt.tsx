import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles } from "lucide-react";

interface UpgradePromptProps {
  type: "branches" | "users";
  current: number;
  max: number;
}

export function UpgradePrompt({ type, current, max }: UpgradePromptProps) {
  const label = type === "branches" ? "الفروع" : "المستخدمين";
  
  return (
    <div className="bg-gradient-to-r from-warning/10 to-primary/10 rounded-2xl border border-warning/20 p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6 text-warning" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-foreground mb-1">
            لقد وصلت للحد الأقصى من {label}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            خطتك الحالية تسمح بـ {max} {label} فقط. 
            قم بترقية خطتك للحصول على المزيد من {label} وميزات إضافية.
          </p>
          <Button className="gap-2">
            <Sparkles className="w-4 h-4" />
            ترقية الخطة
          </Button>
        </div>
      </div>
    </div>
  );
}
