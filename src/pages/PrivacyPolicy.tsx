import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:underline mb-8">
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </Link>

        <h1 className="text-3xl font-bold mb-8">سياسة الخصوصية</h1>
        <p className="text-muted-foreground mb-6">آخر تحديث: 7 أبريل 2026</p>

        <div className="space-y-8 text-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. المقدمة</h2>
            <p>نحن في نظام إدارة التحويلات نلتزم بحماية خصوصيتك وبياناتك الشخصية. توضح هذه السياسة كيف نجمع ونستخدم ونحمي معلوماتك عند استخدامك لخدماتنا.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. البيانات التي نجمعها</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>معلومات الحساب: البريد الإلكتروني، الاسم الكامل، رقم الهاتف</li>
              <li>بيانات المنظمة: اسم المنظمة، بيانات الفروع</li>
              <li>بيانات التحويلات: صور الإيصالات، المبالغ، بيانات المرسل</li>
              <li>سجلات الاستخدام: أوقات تسجيل الدخول، النشاطات داخل النظام</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. كيف نستخدم بياناتك</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>تقديم وتحسين خدماتنا</li>
              <li>معالجة وتحليل إيصالات التحويلات باستخدام الذكاء الاصطناعي</li>
              <li>إرسال إشعارات متعلقة بنشاطك</li>
              <li>كشف ومنع الاحتيال</li>
              <li>إنشاء تقارير مالية لمنظمتك</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. حماية البيانات</h2>
            <p>نستخدم تدابير أمنية متقدمة تشمل:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>تشفير البيانات أثناء النقل والتخزين</li>
              <li>سياسات أمان صارمة على مستوى قاعدة البيانات (RLS)</li>
              <li>فصل بيانات المنظمات عن بعضها البعض</li>
              <li>تخزين المفاتيح الحساسة في جداول مقيدة الوصول</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. مشاركة البيانات</h2>
            <p>لا نبيع أو نؤجر بياناتك الشخصية. قد نشارك بياناتك فقط:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>مع مزودي الخدمات اللازمين لتشغيل النظام (مثل معالجة الصور بالذكاء الاصطناعي)</li>
              <li>عند الضرورة القانونية أو بأمر قضائي</li>
              <li>داخل منظمتك حسب صلاحيات كل مستخدم</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. حقوقك</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>حق الوصول إلى بياناتك الشخصية</li>
              <li>حق تصحيح البيانات غير الدقيقة</li>
              <li>حق حذف حسابك وبياناتك</li>
              <li>حق الاعتراض على معالجة بياناتك</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. الاحتفاظ بالبيانات</h2>
            <p>نحتفظ ببياناتك طالما كان حسابك نشطاً أو حسب ما تقتضيه المتطلبات القانونية. عند حذف حسابك، يتم حذف بياناتك الشخصية خلال 30 يوماً.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. التواصل</h2>
            <p>لأي استفسارات حول هذه السياسة، يمكنك التواصل معنا عبر البريد الإلكتروني أو من خلال النظام مباشرة.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
