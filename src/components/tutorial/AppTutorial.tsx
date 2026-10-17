import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Store, MessageSquare, Receipt, BarChart3, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TUTORIAL_KEY = "app_tutorial_completed";

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  tip: string;
}

const steps: TutorialStep[] = [
  {
    icon: Store,
    title: "١. أضف فروعك",
    description: "ابدأ بإضافة فروع شركتك من صفحة \"الفروع\". كل فرع يمثل نقطة استقبال تحويلات.",
    tip: "يمكنك إضافة فرع واحد للبدء ثم إضافة المزيد لاحقاً.",
  },
  {
    icon: MessageSquare,
    title: "٢. اربط واتساب",
    description: "اربط رقم واتساب بكل فرع من \"إعدادات واتساب\". النظام سيستقبل صور الإيصالات تلقائياً.",
    tip: "يمكنك استخدام Green API أو Meta API حسب احتياجك.",
  },
  {
    icon: Receipt,
    title: "٣. استقبل التحويلات",
    description: "عند إرسال صورة إيصال عبر واتساب، يقوم النظام تلقائياً باستخراج المبلغ وحفظه كتحويل.",
    tip: "يمكنك أيضاً إضافة تحويلات يدوياً من صفحة التحويلات.",
  },
  {
    icon: CheckCircle,
    title: "٤. راجع وأكّد",
    description: "راجع التحويلات المستخرجة وأكّدها. التحويلات ذات الثقة العالية تُقبل تلقائياً.",
    tip: "مؤشر الثقة يوضح مدى دقة الاستخراج التلقائي.",
  },
  {
    icon: BarChart3,
    title: "٥. تابع الإحصائيات",
    description: "تابع أداء فروعك ومبالغ التحويلات من لوحة التحكم وصفحة الإحصائيات.",
    tip: "يمكنك تصفية البيانات حسب الفترة الزمنية أو الفرع.",
  },
];

export function AppTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(TUTORIAL_KEY);
    if (!completed) {
      // Show after a short delay for smoother UX
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(TUTORIAL_KEY, "true");
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (!isOpen) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="bg-card rounded-2xl shadow-2xl border border-border/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="gradient-primary p-6 text-primary-foreground relative">
          <button
            onClick={handleClose}
            className="absolute top-3 left-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <StepIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm opacity-80">دليل البدء السريع</p>
              <h3 className="text-lg font-bold">{step.title}</h3>
            </div>
          </div>
          {/* Progress dots */}
          <div className="flex gap-1.5 mt-4 justify-center">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStep ? "w-6 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-foreground leading-relaxed mb-4">{step.description}</p>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              💡 <span className="font-medium text-foreground">نصيحة:</span> {step.tip}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </Button>

          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>

          <Button size="sm" onClick={handleNext} className="gap-1">
            {currentStep === steps.length - 1 ? "ابدأ الآن" : "التالي"}
            {currentStep < steps.length - 1 && <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Button to re-open tutorial from settings or help */
export function TutorialTrigger() {
  const handleReopen = () => {
    localStorage.removeItem(TUTORIAL_KEY);
    window.location.reload();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleReopen} className="gap-2">
      <BarChart3 className="w-4 h-4" />
      عرض دليل الاستخدام
    </Button>
  );
}
