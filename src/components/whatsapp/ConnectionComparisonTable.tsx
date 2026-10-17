import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  Shield, 
  DollarSign,
  Zap,
  AlertTriangle
} from "lucide-react";

export const ConnectionComparisonTable = () => {
  const features = [
    {
      name: "التكلفة",
      meta: { value: "مجاني بالكامل للاستقبال", icon: CheckCircle, color: "text-emerald-400" },
      green: { value: "$12/شهر/رقم", icon: DollarSign, color: "text-amber-400" },
    },
    {
      name: "الأمان",
      meta: { value: "رسمي 100% - لا خطر حظر", icon: Shield, color: "text-emerald-400" },
      green: { value: "غير رسمي - خطر حظر", icon: AlertTriangle, color: "text-red-400" },
    },
    {
      name: "سهولة الإعداد",
      meta: { value: "متوسط - يحتاج Developer Account", icon: null, color: "text-muted-foreground" },
      green: { value: "سهل جداً - فقط QR Code", icon: Zap, color: "text-emerald-400" },
    },
    {
      name: "استقبال الرسائل",
      meta: { value: "مجاني بالكامل دائماً", icon: CheckCircle, color: "text-emerald-400" },
      green: { value: "مشمول في الاشتراك المدفوع", icon: DollarSign, color: "text-amber-400" },
    },
    {
      name: "إرسال الرسائل",
      meta: { value: "1000 محادثة مجانية/شهر", icon: CheckCircle, color: "text-emerald-400" },
      green: { value: "مشمول في الاشتراك المدفوع", icon: DollarSign, color: "text-amber-400" },
    },
    {
      name: "الموثوقية",
      meta: { value: "عالية جداً - خوادم Meta", icon: CheckCircle, color: "text-emerald-400" },
      green: { value: "متوسطة - طرف ثالث", icon: AlertTriangle, color: "text-amber-400" },
    },
    {
      name: "التكلفة السنوية",
      meta: { value: "$0/سنة", icon: CheckCircle, color: "text-emerald-400" },
      green: { value: "$144/سنة لكل رقم", icon: DollarSign, color: "text-red-400" },
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">مقارنة خيارات الربط</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right p-3 font-medium">الميزة</th>
                <th className="text-center p-3">
                  <div className="flex flex-col items-center gap-1">
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Meta Cloud API
                    </Badge>
                    <span className="text-xs text-emerald-400 font-bold">✓ الخيار الأفضل - مجاني</span>
                  </div>
                </th>
                <th className="text-center p-3">
                  <Badge className="bg-muted text-muted-foreground border-border/50">
                    Green API
                  </Badge>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr key={index} className="border-b border-border/30 last:border-0">
                  <td className="p-3 font-medium">{feature.name}</td>
                  <td className="p-3 text-center">
                    <div className={`flex items-center justify-center gap-1 ${feature.meta.color}`}>
                      {feature.meta.icon && <feature.meta.icon className="w-4 h-4" />}
                      <span className="text-xs">{feature.meta.value}</span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <div className={`flex items-center justify-center gap-1 ${feature.green.color}`}>
                      {feature.green.icon && <feature.green.icon className="w-4 h-4" />}
                      <span className="text-xs">{feature.green.value}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-400 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>
              <strong>توصيتنا:</strong> استخدم Meta Cloud API - مجاني، رسمي، وآمن. وفّر $144/سنة لكل رقم!
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
