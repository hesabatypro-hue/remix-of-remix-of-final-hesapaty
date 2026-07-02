import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logo from "@/assets/logo.png";
import { 
  MessageSquare, 
  BarChart3, 
  Users, 
  Building2, 
  Shield, 
  Zap,
  CheckCircle2,
  ArrowLeft,
  Star,
  Clock,
  Image as ImageIcon,
  Bell
} from "lucide-react";

const Landing = () => {
  const features = [
    {
      icon: MessageSquare,
      title: "استلام تلقائي عبر واتساب",
      description: "استقبل صور إشعارات التحويل مباشرة عبر واتساب وتتم معالجتها تلقائياً"
    },
    {
      icon: ImageIcon,
      title: "استخراج البيانات بالذكاء الاصطناعي",
      description: "يتم استخراج المبلغ وبيانات المرسل تلقائياً من صورة الإشعار"
    },
    {
      icon: Building2,
      title: "إدارة فروع متعددة",
      description: "أدر جميع فروعك من مكان واحد مع تتبع إيرادات كل فرع على حدة"
    },
    {
      icon: BarChart3,
      title: "تقارير وإحصائيات شاملة",
      description: "احصل على رؤية واضحة لأداء عملك مع تقارير يومية وأسبوعية وشهرية"
    },
    {
      icon: Users,
      title: "إدارة فريق العمل",
      description: "أضف مستخدمين بصلاحيات مختلفة: مدير، مشرف، أو مشاهد فقط"
    },
    {
      icon: Shield,
      title: "أمان وخصوصية",
      description: "بياناتك محمية بأعلى معايير الأمان مع تشفير كامل للبيانات"
    }
  ];

  const plans = [
    {
      name: "مجاني",
      price: "0",
      period: "للأبد",
      description: "للتجربة فقط",
      features: [
        "فرع واحد",
        "مستخدم واحد",
        "20 تحويلة شهرياً",
        "بدون تقارير تفصيلية",
        "بدون دعم فني"
      ],
      popular: false,
      buttonText: "جرّب مجاناً"
    },
    {
      name: "الأساسية",
      price: "55,000",
      period: "شهرياً",
      description: "للمتاجر المتوسطة (~10$)",
      features: [
        "حتى 3 فروع",
        "حتى 5 مستخدمين",
        "500 تحويلة شهرياً",
        "تقارير متقدمة",
        "دعم عبر واتساب"
      ],
      popular: true,
      buttonText: "اشترك الآن"
    },
    {
      name: "الاحترافية",
      price: "137,500",
      period: "شهرياً",
      description: "للشركات والسلاسل (~25$)",
      features: [
        "فروع غير محدودة",
        "مستخدمين غير محدودين",
        "تحويلات غير محدودة",
        "تقارير متقدمة مع تصدير",
        "دعم أولوية 24/7",
        "API للتكامل"
      ],
      popular: false,
      buttonText: "تواصل معنا"
    }
  ];

  const steps = [
    {
      number: "1",
      title: "سجّل حسابك",
      description: "أنشئ حساب مؤسستك في دقيقة واحدة فقط"
    },
    {
      number: "2",
      title: "أضف فروعك",
      description: "أضف بيانات فروعك وربط رقم واتساب لكل فرع"
    },
    {
      number: "3",
      title: "استلم التحويلات",
      description: "أرسل صور الإشعارات عبر واتساب ودع النظام يتولى الباقي"
    },
    {
      number: "4",
      title: "تابع تقاريرك",
      description: "احصل على تقارير فورية وشاملة عن جميع إيراداتك"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 glass border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="حساباتي" className="h-10 w-10" />
            <span className="text-xl font-bold text-foreground">حساباتي</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">المميزات</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">كيف يعمل</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">الأسعار</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">تسجيل الدخول</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button className="gradient-primary text-primary-foreground">ابدأ الآن</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6 animate-fade-in">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">نظام إدارة الإيرادات الأذكى</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight animate-slide-up">
            أدر إيرادات متجرك
            <br />
            <span className="text-primary">بذكاء وسهولة</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-slide-up">
            استقبل صور إشعارات التحويل عبر واتساب، ودع الذكاء الاصطناعي يستخرج البيانات تلقائياً.
            تتبع إيرادات جميع فروعك من مكان واحد.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gradient-primary text-primary-foreground text-lg px-8 py-6 shadow-glow">
                ابدأ مجاناً
                <ArrowLeft className="mr-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                شاهد كيف يعمل
              </Button>
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto">
            {[
              { value: "+1000", label: "متجر يستخدم حساباتي" },
              { value: "+50,000", label: "تحويلة شهرياً" },
              { value: "99.9%", label: "وقت التشغيل" },
              { value: "4.9", label: "تقييم المستخدمين", icon: Star }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary flex items-center justify-center gap-1">
                  {stat.value}
                  {stat.icon && <Star className="h-6 w-6 fill-accent text-accent" />}
                </div>
                <div className="text-muted-foreground text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              كل ما تحتاجه لإدارة إيراداتك
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              مجموعة متكاملة من الأدوات لتتبع وإدارة التحويلات المالية لجميع فروعك
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:shadow-glow transition-shadow">
                    <feature.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              كيف يعمل حساباتي؟
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              ابدأ في دقائق معدودة واترك النظام يتولى تتبع إيراداتك
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center relative">
                <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-primary-foreground shadow-glow">
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-0 w-full h-0.5 bg-border -translate-x-1/2" />
                )}
                <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Demo Preview */}
          <div className="mt-16 bg-card rounded-2xl border border-border p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-destructive/50" />
                <div className="h-3 w-3 rounded-full bg-warning/50" />
                <div className="h-3 w-3 rounded-full bg-success/50" />
              </div>
              <div className="flex-1 bg-muted rounded-lg h-8" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 space-y-3">
                <div className="h-8 bg-muted rounded-lg animate-pulse" />
                <div className="h-8 bg-primary/20 rounded-lg" />
                <div className="h-8 bg-muted rounded-lg" />
                <div className="h-8 bg-muted rounded-lg" />
              </div>
              <div className="col-span-2 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-24 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl p-4">
                    <div className="h-3 w-16 bg-muted rounded mb-2" />
                    <div className="h-6 w-20 bg-primary/30 rounded" />
                  </div>
                  <div className="h-24 bg-gradient-to-br from-success/20 to-success/10 rounded-xl p-4">
                    <div className="h-3 w-16 bg-muted rounded mb-2" />
                    <div className="h-6 w-20 bg-success/30 rounded" />
                  </div>
                  <div className="h-24 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl p-4">
                    <div className="h-3 w-16 bg-muted rounded mb-2" />
                    <div className="h-6 w-20 bg-accent/30 rounded" />
                  </div>
                </div>
                <div className="h-40 bg-muted/50 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              خطط تناسب جميع الأحجام
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              اختر الخطة المناسبة لحجم عملك مع إمكانية الترقية في أي وقت
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  plan.popular 
                    ? 'border-primary shadow-glow scale-105' 
                    : 'border-border/50 hover:border-primary/30'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 left-0 gradient-primary text-primary-foreground text-center text-sm py-1 font-medium">
                    الأكثر شعبية
                  </div>
                )}
                <CardContent className={`p-6 ${plan.popular ? 'pt-10' : ''}`}>
                  <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground mr-1">ج.س</span>
                    <span className="text-muted-foreground">/ {plan.period}</span>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center gap-2 text-foreground">
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth?mode=signup" className="block">
                    <Button 
                      className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground' : ''}`}
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.buttonText}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="gradient-primary border-0 overflow-hidden">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                جاهز لإدارة إيراداتك بذكاء؟
              </h2>
              <p className="text-primary-foreground/90 text-lg max-w-2xl mx-auto mb-8">
                انضم إلى أكثر من 1000 متجر يستخدمون حساباتي لتتبع وإدارة إيراداتهم اليومية
              </p>
              <Link to="/auth?mode=signup">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-6 bg-background text-foreground hover:bg-background/90">
                  ابدأ تجربتك المجانية
                  <ArrowLeft className="mr-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <img src={logo} alt="حساباتي" className="h-10 w-10" />
                <span className="text-xl font-bold text-foreground">حساباتي</span>
              </div>
              <p className="text-muted-foreground max-w-sm">
                نظام متكامل لإدارة إيرادات المتاجر عبر استقبال صور التحويلات من واتساب 
                واستخراج البيانات تلقائياً بالذكاء الاصطناعي
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">روابط سريعة</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">المميزات</a></li>
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">كيف يعمل</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">الأسعار</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">تواصل معنا</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <a href="https://wa.me/24926358545" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                    واتساب: +249 26358545
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <span>الخرطوم، السودان</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-muted-foreground">
            <div className="text-center sm:text-right space-y-1">
              <p>© {new Date().getFullYear()} حساباتي. جميع الحقوق محفوظة.</p>
              <p className="text-xs">
                تم التطوير بواسطة{" "}
                <a href="https://suda-technologies.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Suda-Technologies
                </a>
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <a href="/privacy" className="hover:text-foreground transition-colors">سياسة الخصوصية</a>
              <a href="/terms" className="hover:text-foreground transition-colors">شروط الاستخدام</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
