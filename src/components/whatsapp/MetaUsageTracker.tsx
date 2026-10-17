import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, TrendingUp, CheckCircle, AlertTriangle } from "lucide-react";
import { useWhatsAppConnections } from "@/hooks/useWhatsAppConnections";

const FREE_CONVERSATION_LIMIT = 1000;

export const MetaUsageTracker = () => {
  const { connections } = useWhatsAppConnections();
  
  const metaConnections = connections?.filter(c => c.connection_type === "meta") || [];
  const greenConnections = connections?.filter(c => c.connection_type === "green_api") || [];
  const connectedMeta = metaConnections.filter(c => c.status === "connected").length;
  const connectedGreen = greenConnections.filter(c => c.status === "connected").length;

  // Note: In production, you'd track actual usage via Meta's API
  // For now we show the limit info as guidance
  const estimatedUsage = 0; // Would come from actual tracking
  const usagePercentage = (estimatedUsage / FREE_CONVERSATION_LIMIT) * 100;
  const isNearLimit = usagePercentage >= 80;

  return (
    <Card className="border-border/50 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          ملخص الاتصالات والحصة المجانية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium">Meta Cloud API</span>
            </div>
            <p className="text-xl font-bold text-foreground">{connectedMeta}</p>
            <p className="text-xs text-emerald-400">مجاني بالكامل للاستقبال</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Green API</span>
            </div>
            <p className="text-xl font-bold text-foreground">{connectedGreen}</p>
            <p className="text-xs text-muted-foreground">$12/شهر لكل رقم</p>
          </div>
        </div>

        {/* Meta Free Quota */}
        {metaConnections.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">حصة المحادثات المجانية (Meta)</span>
              <span className="font-medium">
                {FREE_CONVERSATION_LIMIT} محادثة/شهر
              </span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <div className="flex items-center gap-2">
              {isNearLimit ? (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  <AlertTriangle className="w-3 h-3 ml-1" />
                  اقتراب من الحد
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                  <CheckCircle className="w-3 h-3 ml-1" />
                  ضمن الحصة المجانية
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                استقبال الرسائل مجاني دائماً بغض النظر عن الحد
              </span>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {greenConnections.length > 0 && metaConnections.length === 0 && (
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>
                <strong>توفير التكلفة:</strong> انتقل إلى Meta Cloud API المجاني لتوفير ${greenConnections.length * 12}/شهر
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
