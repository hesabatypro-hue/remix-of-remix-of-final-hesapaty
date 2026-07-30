import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import logo from "@/assets/logo.png";
import { logAuthNav } from "@/lib/authNavLogger";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

// SECURITY: Strong password policy for a financial system
const passwordSchema = z
  .string()
  .min(8, { message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" })
  .regex(/[A-Z]/, { message: "يجب أن تحتوي على حرف كبير واحد على الأقل" })
  .regex(/[0-9]/, { message: "يجب أن تحتوي على رقم واحد على الأقل" });

const loginSchema = z.object({
  email: z.string().email({ message: "البريد الإلكتروني غير صالح" }),
  password: passwordSchema,
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, { message: "الاسم يجب أن يكون حرفين على الأقل" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user, isLoading: authLoading, userRoles, userDataReady } = useAuth();
  const { toast } = useToast();
  
  const initialMode = new URLSearchParams(location.search).get('mode');
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaState, setMfaState] = useState<{ required: boolean; factorId: string; code: string } | null>(null);

  // SECURITY: Client-side brute force protection
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });

  // Redirect if already logged in.
  // IMPORTANT: do NOT auto-redirect to /onboarding from here — that path is
  // strictly for new signups (handled explicitly in handleSubmit below).
  // Existing users who land on /auth while authenticated should always go
  // to their previous page or the dashboard. ProtectedRoute will handle
  // any further redirection if they happen to have no organization yet.
  useEffect(() => {
    if (user && !authLoading && userDataReady) {
      const from = (location.state as any)?.from?.pathname;
      const to = from || '/dashboard';
      if (to === '/dashboard') {
        logAuthNav('redirect_to_dashboard', {
          from: location.pathname + location.search,
          to,
          userId: user.id,
          meta: { source: 'Auth', userRolesCount: userRoles?.length ?? 0, userDataReady },
        });
      }
      logAuthNav("auth_already_logged_in", {
        from: location.pathname + location.search,
        to,
        userId: user.id,
        meta: { userRolesCount: userRoles?.length ?? 0, userDataReady },
      });
      navigate(to, { replace: true });
    }
  }, [user, authLoading, userDataReady, navigate, location, userRoles]);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse(formData);
      } else {
        signupSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // SECURITY: Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 60000);
      toast({
        title: "الحساب مقفل مؤقتاً",
        description: `محاولات كثيرة. انتظر ${remaining} دقيقة قبل المحاولة مجدداً.`,
        variant: "destructive",
      });
      return;
    }

    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await signIn(formData.email, formData.password);
        if (result.error) {
          logAuthNav("signin_error", { meta: { message: result.error.message } });
          if (result.error.message.includes('Invalid login credentials')) {
            // SECURITY: Track failed attempts
            const attempts = loginAttempts + 1;
            setLoginAttempts(attempts);
            if (attempts >= MAX_ATTEMPTS) {
              setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
              setLoginAttempts(0);
              toast({
                title: "الحساب مقفل مؤقتاً",
                description: "5 محاولات فاشلة. سيتم فتح الحساب بعد 5 دقائق.",
                variant: "destructive",
              });
            } else {
              toast({
                title: "خطأ في تسجيل الدخول",
                description: `البريد الإلكتروني أو كلمة المرور غير صحيحة. المحاولة ${attempts}/${MAX_ATTEMPTS}`,
                variant: "destructive",
              });
            }
          } else {
            toast({
              title: "خطأ",
              description: result.error.message,
              variant: "destructive",
            });
          }
        } else if ((result as any).mfaRequired) {
          // User has 2FA — show challenge screen
          setMfaState({ required: true, factorId: (result as any).factorId, code: '' });
          logAuthNav("signin_mfa_required", { meta: { email: formData.email } });
        } else {
          logAuthNav("signin_success", { meta: { email: formData.email } });
          toast({
            title: "تم تسجيل الدخول بنجاح",
            description: "مرحباً بك",
          });
        }
      } else {
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          logAuthNav("signup_error", { meta: { message: error.message } });
          if (error.message.includes('already registered')) {
            toast({
              title: "خطأ في التسجيل",
              description: "هذا البريد الإلكتروني مسجل مسبقاً",
              variant: "destructive",
            });
          } else {
            toast({
              title: "خطأ",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          logAuthNav("signup_success", { meta: { email: formData.email } });
          logAuthNav("redirect_to_onboarding", { from: "/auth", to: "/onboarding", meta: { reason: "new_signup" } });
          toast({
            title: "تم إنشاء الحساب بنجاح",
            description: "سيتم تحويلك لإعداد مؤسستك",
          });
          navigate('/onboarding');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        logAuthNav("google_signin_error", { meta: { message: result.error.message } });
        toast({
          title: "خطأ في تسجيل الدخول",
          description: result.error.message,
          variant: "destructive",
        });
      }

      if (result.redirected) {
        // Browser will redirect to Google — just return
        return;
      }

      // Tokens received and session set — user is authenticated
      logAuthNav("google_signin_success", {});
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك",
      });
    } catch (error: any) {
      logAuthNav("google_signin_error", { meta: { message: error.message } });
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // MFA Challenge Screen
  if (mfaState?.required) {
    const handleMfaVerify = async () => {
      setIsLoading(true);
      try {
        const { data: challengeData, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: mfaState.factorId });
        if (chalErr) throw chalErr;
        const { error: verifyErr } = await supabase.auth.mfa.verify({
          factorId: mfaState.factorId,
          challengeId: challengeData.id,
          code: mfaState.code,
        });
        if (verifyErr) {
          toast({ title: "رمز غير صحيح", description: "تحقق من رمز المصادقة وأعد المحاولة", variant: "destructive" });
        } else {
          setMfaState(null);
          toast({ title: "تم تسجيل الدخول بنجاح", description: "مرحباً بك" });
        }
      } catch (e: any) {
        toast({ title: "خطأ", description: e.message, variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">التحقق بخطوتين</h2>
            <p className="text-muted-foreground">أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة</p>
          </div>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="text-center text-2xl tracking-widest"
            value={mfaState.code}
            onChange={(e) => setMfaState({ ...mfaState, code: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleMfaVerify()}
          />
          <Button className="w-full" onClick={handleMfaVerify} disabled={isLoading || mfaState.code.length !== 6}>
            {isLoading ? "جاري التحقق..." : "تأكيد"}
          </Button>
          <Button variant="ghost" onClick={() => setMfaState(null)}>العودة لتسجيل الدخول</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <img 
              src={logo} 
              alt="حساباتي" 
              className="w-24 h-24 mx-auto mb-6 rounded-2xl shadow-lg"
            />
            <h1 className="text-3xl font-bold text-foreground">
              {isLogin ? "مرحباً بك في حساباتي" : "إنشاء حساب جديد"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin 
                ? "سجل الدخول للوصول إلى لوحة التحكم" 
                : "أنشئ حسابك مجاناً — الإعداد يستغرق أقل من دقيقة"}
            </p>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full h-12 gap-3"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
            </svg>
            {isLogin ? "تسجيل الدخول بـ Google" : "إنشاء حساب بـ Google"}
          </Button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-background px-3 text-sm text-muted-foreground">
              أو
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="أدخل اسمك الكامل"
                    className={`pr-11 h-12 bg-muted/50 border-border ${errors.fullName ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className={`pr-11 h-12 bg-muted/50 border-border ${errors.email ? 'border-destructive' : ''}`}
                  dir="ltr"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`pr-11 pl-11 h-12 bg-muted/50 border-border ${errors.password ? 'border-destructive' : ''}`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`pr-11 pl-11 h-12 bg-muted/50 border-border ${errors.confirmPassword ? 'border-destructive' : ''}`}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  تذكرني
                </label>
                <a href="#" className="text-sm text-primary hover:underline">
                  نسيت كلمة المرور؟
                </a>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : isLogin ? (
                "تسجيل الدخول"
              ) : (
                "إنشاء الحساب"
              )}
            </Button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="text-center">
            <p className="text-muted-foreground">
              {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormData({ email: "", password: "", confirmPassword: "", fullName: "" });
                }}
                className="text-primary hover:underline mr-2 font-medium"
              >
                {isLogin ? "إنشاء حساب" : "تسجيل الدخول"}
              </button>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            حساباتي - نظام إدارة الإيرادات
          </p>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 gradient-secondary items-center justify-center p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-accent blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center text-secondary-foreground max-w-lg">
          <img 
            src={logo} 
            alt="حساباتي" 
            className="w-40 h-40 mx-auto mb-8 rounded-3xl shadow-2xl animate-float"
          />
          <h2 className="text-4xl font-bold mb-4">
            حساباتي
          </h2>
          <p className="text-xl opacity-80 mb-8">
            تابع إيرادات جميع فروعك بسهولة عبر ربط واتساب والذكاء الاصطناعي
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: "100+", label: "عميل نشط" },
              { value: "10K+", label: "تحويل شهرياً" },
              { value: "99%", label: "وقت التشغيل" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-secondary-foreground/10 backdrop-blur-sm rounded-xl p-4"
              >
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
