import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>

        <h1 className="text-3xl font-bold mb-8">شروط الاستخدام</h1>
        <p className="text-muted-foreground mb-6">آخر تحديث: 7 أبريل 2026</p>

        <div className="space-y-8 text-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. قبول الشروط</h2>
            <p>باستخدامك لنظام إدارة التحويلات، فإنك توافق على هذه الشروط والأحكام. إذا لم توافق على أي من هذه الشروط، يرجى عدم استخدام الخدمة.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. وصف الخدمة</h2>
            <p>نقدم نظاماً لإدارة وتتبع التحويلات المالية عبر واتساب، يشمل:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>استلام وتحليل إيصالات التحويل تلقائياً</li>
              <li>إدارة الفروع والموظفين</li>
              <li>إنشاء تقارير مالية</li>
              <li>كشف الاحتيال بالذكاء الاصطناعي</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. حسابات المستخدمين</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>يجب تقديم معلومات صحيحة ودقيقة عند التسجيل</li>
              <li>أنت مسؤول عن الحفاظ على سرية بيانات حسابك</li>
              <li>يجب إبلاغنا فوراً عن أي استخدام غير مصرح به</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. الاستخدام المقبول</h2>
            <p>يُحظر عليك:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>استخدام الخدمة لأغراض غير قانونية</li>
              <li>محاولة الوصول غير المصرح به لبيانات مستخدمين آخرين</li>
              <li>رفع محتوى ضار أو خبيث</li>
              <li>التلاعب بالبيانات المالية أو تزويرها</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. خطط الاشتراك</h2>
            <p>تتوفر خطط مختلفة بحدود استخدام متنوعة. نحتفظ بحق تعديل الأسعار والميزات مع إشعار مسبق للمشتركين الحاليين.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. إخلاء المسؤولية</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>نسعى لتوفير خدمة موثوقة لكن لا نضمن خلوها من الأخطاء</li>
              <li>تحليل الذكاء الاصطناعي قد لا يكون دقيقاً بنسبة 100%</li>
              <li>لسنا مسؤولين عن أي خسائر ناتجة عن انقطاع الخدمة</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. إنهاء الخدمة</h2>
            <p>نحتفظ بحق تعليق أو إنهاء حسابك في حالة انتهاك هذه الشروط. يمكنك أيضاً إلغاء حسابك في أي وقت.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. تعديل الشروط</h2>
            <p>قد نحدّث هذه الشروط من وقت لآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو من خلال النظام.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
