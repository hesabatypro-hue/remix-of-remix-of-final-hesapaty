
# خطة: عزل الموديولز (Modular ERP Isolation)

## الهدف
عند تفعيل موديول "نقطة البيع والمخزون" يتحول النظام بالكامل إلى واجهة مخصصة لهذا الموديول (Sidebar، Dashboard، Routes، الإحصائيات)، ولا تظهر صفحات ولا بيانات الموديولز الأخرى. نبني بنية قابلة للتوسع لموديولات مستقبلية (Payroll, Printing, Investment) بنفس النمط.

## 1) طبقة الموديولات (Module Registry)
ملف جديد `src/modules/registry.ts` يعرّف كل موديول ككائن مستقل:
```ts
type ModuleKey = 'REVENUE_TRACKER' | 'POS_INVENTORY' | 'PRINTING' | 'INVESTMENT';
interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  isEnabled: (org) => boolean;   // شرط تفعيل الموديول من بيانات المؤسسة
  priority: number;               // للتحديد الافتراضي
  routes: RouteConfig[];          // مسارات الموديول (lazy)
  navItems: NavItem[];            // روابط السايدبار
  Dashboard: LazyExoticComponent; // لوحة تحكم الموديول
  QuickActions?: LazyExoticComponent;
}
```
- كل موديول ملف مستقل: `src/modules/pos/index.ts`, `src/modules/revenue/index.ts` … يصدّر تعريفه.
- المسارات والصفحات الحالية تُنقل تدريجياً تحت `src/modules/<name>/pages/*` مع lazy loading.

## 2) الحالة العامة (Active Module Context)
- `src/modules/ActiveModuleProvider.tsx`: يحسب `activeModule` من `currentOrganization` (أول موديول `isEnabled` حسب `priority`) مع إمكانية تجاوز يدوي محفوظ في `localStorage` (`activeModuleKey:<orgId>`).
- Hook: `useActiveModule()` → `{ activeModule, availableModules, switchModule }`.
- عند تغيير المؤسسة أو تعطيل الموديول الحالي → إعادة الحساب تلقائياً.

## 3) توجيه ديناميكي معزول (Isolated Routing)
- `src/App.tsx`: بدل قائمة `<Route>` الحالية الطويلة، نستخدم `<ModuleRoutes />` الذي:
  - يُدرج فقط مسارات `activeModule.routes` + مسارات مشتركة (settings, organization, users, auth, subscription-invoices).
  - كل مسار داخل `<Suspense>` + `<ErrorBoundary>` مستقل حتى لا يُسقط باقي التطبيق.
  - أي مسار لموديول غير مفعّل → `<Navigate to={activeModule.rootPath} replace />` بدل 404.
- Lazy loading عبر `React.lazy` لكل صفحة موديول → لا يزيد حجم البناء عند إضافة موديول جديد.

## 4) Layout ديناميكي (Shell)
- `DashboardLayout` يبقى قشرة محايدة (Header, NetworkStatus, Content, BottomNav).
- `Sidebar` يقرأ `activeModule.navItems` فقط + العناصر المشتركة (المؤسسة، الإعدادات، الاشتراك، تسجيل الخروج). ينتهي الاعتماد على flags منتشرة (`posOnly`, `hideWhenPOS`, `printingOnly`).
- `BottomNav` يعرض أول 4 من `activeModule.navItems`.
- Header يعرض اسم الموديول النشط + Switcher سريع للموديولات المتاحة (لو المؤسسة فعّلت أكثر من واحد).

## 5) لوحة التحكم السياقية (Context-Aware Dashboard)
- `/dashboard` تصبح Route ثابت يعرض `<activeModule.Dashboard />`.
- `src/modules/pos/dashboard/POSDashboard.tsx`: إحصائيات مبيعات POS اليومية، عدد الفواتير، تنبيهات مخزون منخفض، أداء الفروع (مبيعات POS)، آخر الفواتير، Quick Actions لـ POS. لا يقرأ من `transfers`.
- `src/modules/revenue/dashboard/RevenueDashboard.tsx`: الحالي الموجود في `Dashboard.tsx` يُنقل كما هو.
- كل Dashboard يجلب بياناته من hooks خاصة به فقط (`usePOSStats`, `useDashboardStats`).

## 6) هيكل المجلدات النهائي
```text
src/
  modules/
    registry.ts
    ActiveModuleProvider.tsx
    ModuleRoutes.tsx
    shared/           # صفحات مشتركة (Settings, Organization, Users…)
    pos/
      index.ts        # تعريف الموديول
      dashboard/POSDashboard.tsx
      pages/          # POS.tsx, Products.tsx, Inventory.tsx (نُقلت)
      hooks/          # usePOSStats, usePOSInvoices…
      components/     # POSInvoiceDialog…
    revenue/
      index.ts
      dashboard/RevenueDashboard.tsx
      pages/          # Transfers, Reports, Review, WhatsApp*, Statistics…
      hooks/
    printing/  (مستقبلي)
    investment/ (مستقبلي)
```
تنفيذ الخطوة على مرحلتين لتقليل المخاطر:
- **المرحلة أ (هذه الجلسة):** إنشاء الطبقة (`registry`, `ActiveModuleProvider`, `ModuleRoutes`, dashboards للموديولين) مع **إبقاء ملفات `src/pages/*` مكانها** واستيرادها من الموديولات (re-export). هذا يعطي العزل الكامل بدون نقل ملفات ضخم.
- **المرحلة ب (تدريجية لاحقاً):** نقل الملفات فعلياً تحت `modules/*/pages` عند الحاجة.

## 7) الحماية والاستقرار
- كل صفحة موديول محاطة بـ `ModuleErrorBoundary` (نسخة من `ErrorBoundary` مع رسالة عربية + زر رجوع للـ dashboard) → سقوط موديول لا يُسقط التطبيق.
- `Suspense fallback` = skeleton خفيف.
- منع الوصول: `ProtectedRoute` يفحص انتماء المسار للموديول النشط، وإلا يوجّه إلى `activeModule.rootPath`.

## 8) UX
- عند تفعيل POS من صفحة "المؤسسة → نوع النشاط": بعد الحفظ نستدعي `switchModule('POS_INVENTORY')` تلقائياً + toast: "تم التبديل إلى نظام نقطة البيع" + تحويل إلى `/dashboard`.
- إذا فُعّل أكثر من موديول: Header يظهر `Select` صغير بين الموديولات المتاحة (يحفظ الاختيار في localStorage للمستخدم/المؤسسة).
- Sidebar يعرض شارة أعلى القائمة باسم الموديول النشط لتوضيح السياق.

## 9) التسليم (Deliverables)
ملفات جديدة:
- `src/modules/registry.ts`
- `src/modules/ActiveModuleProvider.tsx`
- `src/modules/ModuleRoutes.tsx`
- `src/modules/ModuleErrorBoundary.tsx`
- `src/modules/pos/index.ts`
- `src/modules/pos/dashboard/POSDashboard.tsx`
- `src/modules/pos/hooks/usePOSStats.ts`
- `src/modules/revenue/index.ts`
- `src/modules/revenue/dashboard/RevenueDashboard.tsx`
- `src/modules/shared/index.ts` (تعريف الروابط والمسارات المشتركة)

تعديلات:
- `src/App.tsx` → استخدام `ModuleRoutes` + `ActiveModuleProvider`.
- `src/components/layout/Sidebar.tsx` → قراءة من `useActiveModule()`.
- `src/components/layout/BottomNav.tsx` → قراءة من `useActiveModule()`.
- `src/pages/Dashboard.tsx` → shell يعرض `activeModule.Dashboard`.
- `src/pages/OrganizationSettings.tsx` → بعد تفعيل POS: `switchModule` + toast + تحويل.
- `src/hooks/usePOSMode.ts` → يبقى مغلّفاً حول `useActiveModule` للتوافق الرجعي.

## 10) ملاحظات تقنية
- لا تغييرات في قاعدة البيانات في هذه المرحلة (الأعمدة `is_pos_enabled`, `industry_type`, `investment_enabled`, `invoicing_enabled` كافية).
- `usePOSStats` يستعلم `pos_invoices` + `products` (تنبيهات مخزون) بدلاً من `transfers`.
- لا يتم لمس منطق المصادقة أو الأدوار.
- كل موديول يُصدَّر ككائن واحد → إضافة موديول جديد لاحقاً = ملف واحد + تسجيله في `registry.ts` بدون تعديل `App.tsx` أو `Sidebar.tsx`.
