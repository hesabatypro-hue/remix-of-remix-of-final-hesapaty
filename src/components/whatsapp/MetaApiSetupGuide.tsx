import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  ExternalLink, 
  Copy, 
  ChevronDown, 
  ChevronUp,
  Shield,
  Zap,
  DollarSign,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import step1Img from "@/assets/meta-step1-create-app.jpg";
import step2Img from "@/assets/meta-step2-add-whatsapp.jpg";
import step3Img from "@/assets/meta-step3-access-token.jpg";
import step4Img from "@/assets/meta-step4-webhook.jpg";
import step5Img from "@/assets/meta-step5-system-user.jpg";

interface MetaApiSetupGuideProps {
  webhookUrl: string;
  verifyToken: string;
}

export const MetaApiSetupGuide = ({ webhookUrl, verifyToken }: MetaApiSetupGuideProps) => {
  const { toast } = useToast();
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("meta-guide-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("meta-guide-collapsed", String(isCollapsed));
  }, [isCollapsed]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "تم النسخ",
      description: `تم نسخ ${label}`,
    });
  };

  const markStepDone = (stepNum: number) => {
    if (!completedSteps.includes(stepNum)) {
      setCompletedSteps([...completedSteps, stepNum]);
    }
    // Auto-open next step
    if (stepNum < 5) {
      setExpandedStep(stepNum + 1);
    }
  };

  const steps = [
    {
      number: 1,
      title: "إنشاء حساب Meta Developer",
      estimatedTime: "3 دقائق",
      image: step1Img,
      content: (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg overflow-hidden border border-border/50">
            <img src={step1Img} alt="إنشاء تطبيق Meta" className="w-full h-auto" loading="lazy" />
          </div>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span>
              <span>اذهب إلى <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">developers.facebook.com</a> وسجّل الدخول بحساب Facebook</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span>
              <span>اضغط على <strong className="text-foreground">"My Apps"</strong> ثم <strong className="text-foreground">"Create App"</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span>
              <span>اختر <strong className="text-foreground">"Other"</strong> ثم <strong className="text-foreground">"Business"</strong> كنوع التطبيق</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">4</span>
              <span>أدخل اسم التطبيق (مثال: "نظام التحويلات") واضغط <strong className="text-foreground">"Create App"</strong></span>
            </li>
          </ol>
          <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
            <a href="https://developers.facebook.com/apps/create/" target="_blank" rel="noopener noreferrer">
              فتح صفحة إنشاء التطبيق
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      ),
    },
    {
      number: 2,
      title: "إضافة WhatsApp للتطبيق",
      estimatedTime: "2 دقائق",
      image: step2Img,
      content: (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg overflow-hidden border border-border/50">
            <img src={step2Img} alt="إضافة WhatsApp" className="w-full h-auto" loading="lazy" />
          </div>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span>
              <span>في لوحة التحكم، اضغط <strong className="text-foreground">"Add Product"</strong> من القائمة الجانبية</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span>
              <span>ابحث عن <strong className="text-foreground">"WhatsApp"</strong> واضغط <strong className="text-foreground">"Set Up"</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span>
              <span>اختر أو أنشئ <strong className="text-foreground">Meta Business Account</strong> (مجاني)</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">4</span>
              <span>سيظهر لك رقم اختبار مجاني يمكنك استخدامه فوراً</span>
            </li>
          </ol>
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <p className="text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              يمكنك إضافة رقمك الخاص لاحقاً أو البدء برقم الاختبار المجاني
            </p>
          </div>
        </div>
      ),
    },
    {
      number: 3,
      title: "الحصول على Phone Number ID و Access Token",
      estimatedTime: "2 دقائق",
      image: step3Img,
      content: (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg overflow-hidden border border-border/50">
            <img src={step3Img} alt="Access Token" className="w-full h-auto" loading="lazy" />
          </div>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span>
              <span>اذهب إلى <strong className="text-foreground">WhatsApp → API Setup</strong> في القائمة الجانبية</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span>
              <span>انسخ <strong className="text-foreground">"Phone Number ID"</strong> - ستحتاجه لاحقاً</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span>
              <span>انسخ <strong className="text-foreground">"Temporary Access Token"</strong> للاختبار السريع</span>
            </li>
          </ol>
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <p className="text-amber-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Token المؤقت ينتهي خلال 24 ساعة. للإنتاج، أكمل الخطوة 5 للحصول على Token دائم.
            </p>
          </div>
        </div>
      ),
    },
    {
      number: 4,
      title: "إعداد Webhook لاستقبال الرسائل",
      estimatedTime: "3 دقائق",
      image: step4Img,
      content: (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg overflow-hidden border border-border/50">
            <img src={step4Img} alt="إعداد Webhook" className="w-full h-auto" loading="lazy" />
          </div>
          <p className="text-muted-foreground font-medium">اذهب إلى <strong className="text-foreground">WhatsApp → Configuration</strong> وانسخ البيانات التالية:</p>
          
          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center gap-1">
              Callback URL
              <Badge variant="outline" className="text-[10px]">مطلوب</Badge>
            </label>
            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="text-left font-mono text-xs bg-muted/30"
                dir="ltr"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(webhookUrl, "Callback URL")}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium flex items-center gap-1">
              Verify Token
              <Badge variant="outline" className="text-[10px]">مطلوب</Badge>
            </label>
            <div className="flex gap-2">
              <Input
                value={verifyToken}
                readOnly
                className="text-left font-mono text-xs bg-muted/30"
                dir="ltr"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(verifyToken, "Verify Token")}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <p className="text-blue-400 text-xs">
              <strong>مهم:</strong> بعد لصق البيانات، اضغط <strong>"Verify and Save"</strong>، ثم فعّل حقل <strong>"messages"</strong> من Webhook Fields
            </p>
          </div>
        </div>
      ),
    },
    {
      number: 5,
      title: "إنشاء Token دائم (للإنتاج)",
      estimatedTime: "5 دقائق",
      image: step5Img,
      content: (
        <div className="space-y-4 text-sm">
          <div className="rounded-lg overflow-hidden border border-border/50">
            <img src={step5Img} alt="System User Token" className="w-full h-auto" loading="lazy" />
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 mb-2">
            <p className="text-blue-400 text-xs flex items-center gap-2">
              <Zap className="w-4 h-4 shrink-0" />
              هذه الخطوة اختيارية للاختبار، لكنها <strong>ضرورية للإنتاج</strong> لأن Token المؤقت ينتهي.
            </p>
          </div>
          <ol className="space-y-3 text-muted-foreground">
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span>
              <span>اذهب إلى <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">Meta Business Settings → System Users</a></span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span>
              <span>اضغط <strong className="text-foreground">"Add"</strong> وأنشئ System User جديد باسم مميز</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span>
              <span>اختر الدور <strong className="text-foreground">"Admin"</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">4</span>
              <span>اضغط <strong className="text-foreground">"Generate New Token"</strong> واختر التطبيق</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">5</span>
              <span>فعّل صلاحية <strong className="text-foreground">"whatsapp_business_messaging"</strong> و <strong className="text-foreground">"whatsapp_business_management"</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">6</span>
              <span>اضغط <strong className="text-foreground">"Generate Token"</strong> وانسخ الـ Token الدائم</span>
            </li>
          </ol>
          <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
            <a href="https://business.facebook.com/settings/system-users" target="_blank" rel="noopener noreferrer">
              فتح إعدادات System Users
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
          <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <p className="text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              الـ Token الدائم لا ينتهي أبداً ويعمل بشكل مستمر بدون تدخل منك
            </p>
          </div>
        </div>
      ),
    },
  ];

  const progress = (completedSteps.length / steps.length) * 100;

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            دليل إعداد WhatsApp Cloud API خطوة بخطوة
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {isCollapsed ? "عرض الدليل" : "إخفاء"}
          </Button>
        </CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
            <Zap className="w-3 h-3 ml-1" />
            رسمي وآمن 100%
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <DollarSign className="w-3 h-3 ml-1" />
            مجاني بالكامل للاستقبال
          </Badge>
          <Badge className="bg-muted text-muted-foreground border-border/50">
            <Clock className="w-3 h-3 ml-1" />
            ~15 دقيقة للإعداد الكامل
          </Badge>
        </div>
        {/* Progress bar */}
        {completedSteps.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>تقدم الإعداد</span>
              <span>{completedSteps.length}/{steps.length} خطوات مكتملة</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-2">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.number);
            return (
              <div key={step.number} className={`border rounded-lg overflow-hidden transition-colors ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50'}`}>
                <button
                  className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedStep(expandedStep === step.number ? null : step.number)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-primary/20 text-primary'}`}>
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : step.number}
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-sm block">{step.title}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {step.estimatedTime}
                      </span>
                    </div>
                  </div>
                  {expandedStep === step.number ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {expandedStep === step.number && (
                  <div className="p-4 pt-0 border-t border-border/50 space-y-3">
                    {step.content}
                    {!isCompleted && (
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        variant="outline"
                        onClick={() => markStepDone(step.number)}
                      >
                        <CheckCircle className="w-4 h-4" />
                        أكملت هذه الخطوة
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {completedSteps.length === steps.length && (
            <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-emerald-400 font-medium">🎉 تهانينا! أكملت جميع خطوات الإعداد</p>
              <p className="text-xs text-muted-foreground">الآن أضف بيانات الربط في نموذج "ربط فرع جديد" أعلاه</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
