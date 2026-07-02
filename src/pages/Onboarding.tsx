import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Building2, ArrowLeft, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const organizationSchema = z.object({
  name: z.string().min(2, { message: "اسم المؤسسة يجب أن يكون حرفين على الأقل" }),
  slug: z.string()
    .min(3, { message: "المعرف يجب أن يكون 3 أحرف على الأقل" })
    .regex(/^[a-z0-9-]+$/, { message: "المعرف يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط" }),
});

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUserData } = useAuth();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug || generateSlug(name),
    }));
    if (errors.name) {
      setErrors(prev => ({ ...prev, name: "" }));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData(prev => ({ ...prev, slug }));
    if (errors.slug) {
      setErrors(prev => ({ ...prev, slug: "" }));
    }
  };

  const validateForm = () => {
    try {
      organizationSchema.parse(formData);
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
    
    if (!validateForm() || !user) return;
    
    setIsLoading(true);

    try {
      // Check if slug is unique
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', formData.slug)
        .maybeSingle();

      if (existingOrg) {
        setErrors({ slug: "هذا المعرف مستخدم بالفعل، اختر معرفاً آخر" });
        setIsLoading(false);
        return;
      }

      // Create organization + add current user as owner (atomic)
      const { data: newOrg, error: orgError } = await supabase
        .rpc('create_organization_with_owner', {
          _name: formData.name,
          _slug: formData.slug,
        });

      if (orgError) throw orgError;
      if (!newOrg) throw new Error('تعذر إنشاء المؤسسة');

      // Refresh user data to get the new organization
      await refreshUserData();

      toast({
        title: "تم إنشاء المؤسسة بنجاح",
        description: `مرحباً بك في ${formData.name}`,
      });

      navigate('/');
    } catch (error: any) {
      console.error('Error creating organization:', error);
      toast({
        title: "خطأ في إنشاء المؤسسة",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Check className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">إنشاء الحساب</span>
          </div>
          <div className="w-12 h-0.5 bg-primary" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              2
            </div>
            <span className="text-sm font-medium">إعداد المؤسسة</span>
          </div>
          <div className="w-12 h-0.5 bg-muted" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
              3
            </div>
            <span className="text-sm text-muted-foreground">البدء</span>
          </div>
        </div>

        <Card className="animate-fade-in">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
              <Building2 className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">إعداد مؤسستك</CardTitle>
            <CardDescription>
              خطوة واحدة فقط! أدخل اسم مؤسستك وسنجهز لك كل شيء لإدارة الفروع والتحويلات.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">اسم المؤسسة</Label>
                <div className="relative">
                  <Store className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={handleNameChange}
                    placeholder="مثال: شركة البركة للتجارة"
                    className={`pr-11 h-12 ${errors.name ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">المعرف الفريد</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    .hesabaty.app
                  </span>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={handleSlugChange}
                    placeholder="albaraka"
                    className={`pl-24 h-12 ${errors.slug ? 'border-destructive' : ''}`}
                    dir="ltr"
                  />
                </div>
                {errors.slug ? (
                  <p className="text-sm text-destructive">{errors.slug}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    سيكون رابط مؤسستك: {formData.slug || 'your-company'}.hesabaty.app
                  </p>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">الخطة المجانية تتضمن:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    فرعين كحد أقصى
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    3 مستخدمين
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    تكامل واتساب أساسي
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full h-12"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    إنشاء المؤسسة
                    <ArrowLeft className="w-5 h-5 mr-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
