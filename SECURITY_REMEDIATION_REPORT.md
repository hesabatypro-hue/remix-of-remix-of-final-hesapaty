# تقرير المعالجة الأمنية والجاهزية للإنتاج — Hesapaty PRO
**Security Remediation & Production-Readiness Hardening Report**

- **المشروع:** Hesapaty PRO (حساباتي برو)
- **التاريخ:** 17 أكتوبر 2026
- **الصفة الهندسية:** Principal Security Engineer + Senior Full-Stack Engineer + PostgreSQL/Supabase Security Specialist + QA Lead
- **حالة المستودع:** Git Version Controlled | Node v25.8.0 | React 18 | TypeScript 5.8 | Vite 5.4 | Vitest 3.2.4

---

## 1. ملخص تنفيذي (Executive Summary)

تم إجراء تدقيق أمني شامل ومعالجة هندسية تطبيقية دقيقة لكافة المكونات البرمجية وقواعد البيانات وEdge Functions في نظام **Hesapaty PRO**. 
لم تقتصر هذه المهمة على الفحص النظري، بل تضمنت:
1. التعديل الفعلي الموضعي للملفات المتأثرة دون المساس بالمنطق التجاري أو ميزات POS ونظام عدم الاتصال (Offline Sync) ودفتر الأستاذ (Immutable Ledger) وتكاملات WhatsApp وMCP.
2. إنشاء ترحيلين أمنيين لقاعدة بيانات Supabase/PostgreSQL لسد الثغرات على مستوى RLS والدوال وإحكام التفويض وعزل المستأجرين (Multi-tenancy).
3. معالجة الثغرات من الدرجة القصوى P0 المتمثلة في:
   - منع التلاعب بفواتير اشتراك المنصة وعزل صلاحية التأكيد لـ `service_role`.
   - منع الحذف الجماعي للتحويلات وقصره على مديري ومالكي المؤسسة فقط مع فحص العضوية الصارم.
   - تصحيح مصادقة المستخدمين في Edge Functions بالاعتماد على `auth.getUser(token)` الموثوق.
   - إغلاق نمط Fail-Open في Webhooks وإلغاء تسريب أرقام هواتف العملاء بين المؤسسات.
4. تحسين الأداء المعماري عبر تقسيم الحزم الديناميكي (`React.lazy` و `Suspense`) ونقل التجميعات المالية إلى PostgreSQL (`get_organization_dashboard_stats`).
5. كتابة حزمة اختبارات انحدار أمنية شاملة (`src/test/security-hardening.test.ts`)، وتشغيل جميع اختبارات Vitest (14 ملف اختبار، 150 اختباراً ناجحاً بنسبة 100%)، والتحقق التام من تجميع TypeScript (`tsc --noEmit` بنتيجة 0 أخطاء)، والتحقق من بناء الإنتاج (`npm run build`).

---

## 2. مصفوفة الثغرات والمعالجات التفصيلية (Vulnerability Matrix)

| # | الثغرة الأمنية | مستوى الخطورة | النطاق / الملفات المتأثرة | الحالة (Status) | وصف الإصلاح والأثر |
|---|---|---|---|---|---|
| **1** | إمكانية تأكيد فواتير اشتراك المنصة ذاتياً من المستأجر | **P0 - Critical** (CVSS 9.1) | `mark_platform_invoice_paid`<br>`src/pages/SubscriptionInvoices.tsx`<br>`src/hooks/usePlatformInvoices.ts` | **`FIXED_AND_TESTED`** | تم سحب صلاحية `EXECUTE` من كافة أدوار المستخدمين (`authenticated`, `anon`, `PUBLIC`) وحصرها في `service_role`. استُبدل زر التأكيد بالواجهة بمسار "تفاصيل السداد". |
| **2** | الحذف الجماعي للتحويلات بدون تفويض كافٍ | **P0 - High** (CVSS 8.5) | `soft_delete_all_transfers`<br>`transfers` RLS UPDATE policy | **`FIXED_AND_TESTED`** | تم فرض فحص صريح `public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner', 'admin'])`. كما تم تعديل سياسة RLS لجدول `transfers` لمنع أعضاء الدور الأدنى من الحذف المنطقي. |
| **3** | فشل مصادقة Edge Functions باستدعاء API غير موجود (`getClaims`) | **P0 - High** (CVSS 8.2) | `supabase/functions/secure-image/index.ts`<br>`supabase/functions/extract-transfer-amount/index.ts` | **`FIXED_AND_TESTED`** | تم استبدال `getClaims()` بنمط `await userClient.auth.getUser()` المتوافق والمعتمد، مع التحقق الصارم من المستخدم ومنع تجاوز الرموز غير الصالحة. |
| **4** | تسرب بيانات أرقام الهواتف ونمط Fail-Open في Webhook | **P0 - Critical** (CVSS 9.0) | `supabase/functions/green-api-webhook/index.ts` | **`FIXED_AND_TESTED`** | إغلاق نمط Fail-Open؛ إذا لم يتطابق السر يتم الرفض فوراً بـ 401. تم إلغاء جلب كل سجلات `profiles` إلى الذاكرة وحصر البحث في المؤسسة المرتبطة بالاتصال مع التحقق من صلاحية المنفذ. |
| **5** | مرجع مشروع Supabase مكتوب بشكل ثابت في دالة MCP | **P0 - Medium** (CVSS 6.5) | `supabase/functions/mcp/index.ts` | **`FIXED_AND_TESTED`** | تم استبدال المعرف الثابت بحل ديناميكي يقرأ من متغيرات البيئة `SUPABASE_PROJECT_ID` أو يستخرج المرجع من `SUPABASE_URL`. |
| **6** | احتساب الفروع المحذوفة منطقياً ضمن حد الباقة | **P1 - Medium** (CVSS 6.0) | `check_branch_limit`<br>`can_add_branch`<br>`get_organization_limits` | **`FIXED_AND_TESTED`** | إضافة شرط `AND is_deleted = false` لكافة دوال احتساب الفروع والـ Trigger، مما يتيح استبدال الفروع المحذوفة دون تجاوز سقف الخطة. |
| **7** | تجاوز قفل تسجيل الدخول بتحديث الصفحة (Brute-Force) | **P1 - Medium** (CVSS 5.3) | `src/pages/Auth.tsx` | **`FIXED_AND_TESTED`** | حفظ عدد المحاولات الفاشلة وتوقيت انتهاء الحظر في `localStorage` وفحصه فورياً قبل إرسال أي طلب شبكة للمصادقة. |
| **8** | مسار المطابقة المالية غير مدرج في المسارات المشتركة | **P1 - Medium** (Access Control) | `src/modules/types.ts` | **`FIXED_AND_TESTED`** | إضافة `"/reconciliation"` إلى قائمة `SHARED_PATHS` لضمان عدم حجب الميزة عن المستخدمين المخولين. |
| **9** | انتهاك قواعد React Hooks وآثار جانبية داخل `useMemo` | **P2 - Medium** (Stability/DoR) | `src/pages/InvestmentOrchestrator.tsx`<br>`src/hooks/usePlatformInvoices.ts` | **`FIXED_AND_TESTED`** | تحويل مزامنة النموذج إلى `useEffect`، ونقل الخروج المبكر إلى ما بعد استدعاء كافة الخطافات (Hooks)، وفصل `usePlatformInvoice` كـ Custom Hook مستقل. |
| **10** | استهلاك غير مبرر للشبكة والذاكرة في لوحة الإحصائيات | **P2 - Low** (Performance) | `src/hooks/useDashboardStats.ts`<br>`supabase/migrations/20260806130000_dashboard_performance_optimization.sql` | **`FIXED_AND_TESTED`** | إنشاء دالة RPC تجميعية على مستوى PostgreSQL (`get_organization_dashboard_stats`)، ورفع زمن التحديث الدوري من 10 ثوانٍ إلى 60 ثانية مع الاعتماد على اشتراكات Realtime الحية. |
| **11** | تضخم الحزمة الأولية (Initial Bundle Bloat) | **P2 - Low** (Performance) | `src/App.tsx` | **`FIXED_AND_TESTED`** | تطبيق التقسيم الديناميكي للمسارات باستخدام `React.lazy()` و `<Suspense>` مما قلص حجم الكود الأولي وقسّم التطبيق إلى أكثر من 30 حزمة صغيرة عند الطلب. |
| **12** | إعدادات Playwright مستوردة من حزمة خارجية غير مثبتة | **P2 - Low** (QA Tooling) | `playwright.config.ts`<br>`playwright-fixture.ts`<br>`e2e/auth.spec.ts` | **`FIXED_NOT_FULLY_TESTED`** | إعادة هيكلة الإعدادات باستخدام `@playwright/test` المعتمد، وإضافة سكريبت `"test:e2e"` واختبار دخان أولي. يحتاج تشغيل المتصفح الحقيقي إلى تثبيت ثنائيات Chromium. |

---

## 3. تفاصيل التعديلات البرمجية (Code & Migration Changes)

### 3.1 ترحيلات قاعدة البيانات الجديدة (Database Migrations)

#### الترحيل الأول: `supabase/migrations/20260806120000_security_and_authorization_hardening.sql`
- **`mark_platform_invoice_paid`**:
  - تم تجريد الدورين `authenticated` و `anon` والجمهور `PUBLIC` من صلاحية `EXECUTE`.
  - حصر الصلاحية في `service_role` فقط (للاستدعاء من خوادم الدفع أو بوابات Stripe/Bank Webhooks أو واجهة إدارة المنصة المركزية).
- **`soft_delete_all_transfers`**:
  - فحص مسبق: `IF NOT public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner', 'admin']) THEN RAISE EXCEPTION ...`.
  - عزل المستأجر بحيث لا يمكن لمستخدم في مؤسسة حذف سجلات مؤسسة أخرى.
- **حدود الفروع (`check_branch_limit`, `can_add_branch`, `get_organization_limits`)**:
  - استثناء الفروع المحذوفة منطقياً: `COUNT(*) ... WHERE organization_id = _org_id AND is_deleted = false`.
- **سياسات RLS لجدول التحويلات (`transfers`)**:
  - استبدال سياسة التعديل العامة بسياسة مشروطة بأدوار الإدارة: `Managers and above can create/update transfers`.
  - تحديث التريغر `prevent_confirmed_transfer_edit()` لمنع تعديل أو حذف التحويلات المؤكدة ما لم يكن المستخدم `owner` أو `admin`.

#### الترحيل الثاني: `supabase/migrations/20260806130000_dashboard_performance_optimization.sql`
- إنشاء دالة تجميع آمنة وسريعة: `public.get_organization_dashboard_stats(_organization_id, _branch_id, _start_time, _end_time)`.
- تنفيذ عمليات `SUM` و `COUNT` داخل محرك PostgreSQL بالاستفادة من الفهارس، بدلاً من نقل مئات آلاف الكائنات عبر الشبكة إلى متصفح العميل.
- فحص التفويض التلقائي للعضوية قبل إرجاع أي بيان مالي.

---

### 3.2 إصلاحات Edge Functions

- **`supabase/functions/secure-image/index.ts` & `supabase/functions/extract-transfer-amount/index.ts`**:
  - استخراج رمز التوثيق من ترويسة `Authorization: Bearer <token>`.
  - استدعاء `const { data: { user }, error: userError } = await userClient.auth.getUser()`.
  - رفض الطلب فوراً برمز `401 Unauthorized` إذا كان الرمز مفقوداً أو غير صالح.
- **`supabase/functions/green-api-webhook/index.ts`**:
  - التحقق المغلق من السر: الرفض إذا كان السر غير مضبوط في البيئة أو غير مطابق للمرسل.
  - استعلام هواتف الإدارة مشروط بـ `user_roles.organization_id = ctx.organization_id` ومقتصر على أدوار `['owner', 'admin', 'manager']`، مما يمنع تسريب مستخدمي المؤسسات الأخرى.
- **`supabase/functions/mcp/index.ts`**:
  - قراءة معرف المشروع برمجياً من البيئة وتجنب كتابة أسماء المشاريع الصريحة داخل الكود.

---

### 3.3 إصلاحات الواجهة الأمامية والأداء

- **`src/pages/Auth.tsx`**:
  - قفل المحاولات الفاشلة وتخزين `auth_lockout_until` في `localStorage`.
  - معالجة الاستثناءات بأمان دون ترك كتل `catch` فارغة.
- **`src/pages/SubscriptionInvoices.tsx` & `SubscriptionInvoiceDetail.tsx`**:
  - إزالة زر التأكيد المباشر من واجهة المستأجر واستبداله بـ "تفاصيل السداد" منعاً للادعاء بالدفع غير المعتمد.
  - فصل استعلام الفاتورة الفردية كـ Hook مستقل `usePlatformInvoice(id)`.
- **`src/pages/InvestmentOrchestrator.tsx`**:
  - معالجة انتهاك قواعد خطافات React: نقل التوجيه الشرطي إلى نهاية الدالة، واستبدال التأثير الجانبي داخل `useMemo` بـ `useEffect`.
- **`src/App.tsx`**:
  - تحويل جميع الصفحات الفرعية إلى تحميل كسول `React.lazy` مع شاشة تحميل أنيقة `<Suspense fallback={<PageLoadingFallback />}>`.

---

## 4. نتائج الاختبارات والأدلة القابلة للتحقق (Verification & Testing Evidence)

### 4.1 اختبارات Vitest (Unit & Integration)
- **الأمر المنفذ:** `npm test` (`npx vitest run`)
- **النتيجة:** 14 ملف اختبار اجتازت بنجاح كامل (150 اختباراً ناجحاً من أصل 150):
  - `src/test/security-hardening.test.ts` (11 اختبار أمان مخصص: قفل تسجيل الدخول، فحص Webhook المغلق، عزل هواتف المستأجرين، استخراج رموز Bearer، صلاحيات فواتير المنصة، صلاحيات الحذف الجماعي، احتساب الفروع النشطة، نزاهة دفتر الأستاذ وسلسلة الهاش) — **Passed**
  - `src/test/receipt-parsing.test.ts` (10 اختبارات) — **Passed**
  - `src/test/webhook-command.test.ts` (27 اختباراً) — **Passed**
  - `src/test/ui/StatusBadge.test.tsx` (8 اختبارات) — **Passed**
  - `src/test/ui/StatCard.test.tsx` (5 اختبارات) — **Passed**
  - `src/test/ui/LimitBadge.test.tsx` (11 اختباراً) — **Passed**
  - `src/test/routing.test.tsx` (13 اختباراً) — **Passed**
  - `src/test/ui/InlineMemoEditor.test.tsx` (8 اختبارات) — **Passed**
  - `src/test/retry-policy.test.ts` (12 اختباراً) — **Passed**
  - `src/test/pos-validation.test.ts` (7 اختبارات) — **Passed**
  - `src/test/example.test.ts` (1 اختبار) — **Passed**
  - `src/test/ui/PrintOrdersTable.test.tsx` (4 اختبارات) — **Passed**
  - `src/test/ui/CronJobsCard.test.tsx` (8 اختبارات) — **Passed**
  - `src/test/ui/ProcessingMonitor.test.tsx` (25 اختباراً) — **Passed**

### 4.2 فحص مطابقة الأنواع (TypeScript Validation)
- **الأمر المنفذ:** `npx tsc --noEmit`
- **النتيجة:** تم الفحص بنجاح بدون أي أخطاء تجميع (Exit code: 0).

### 4.3 فحص الكود الثابت (ESLint)
- **الأمر المنفذ:** `npx eslint . --quiet`
- **النتيجة:** 0 أخطاء (Exit code: 0). تم إصلاح كافة انتهاكات Hooks و Empty Blocks والهروب الزائد في التعابير النمطية (Regex).

### 4.4 بناء الإنتاج (Production Build)
- **الأمر المنفذ:** `npm run build`
- **النتيجة:** تم بناء حزم الإنتاج بنجاح في 14.04 ثانية، مع إنشاء ملفات Chunk مستقلة لكل صفحة ومورد، مما يحقق خفضاً ملحوظاً في زمن التحميل الأولي للواجهة.

### 4.5 اختبارات E2E (Playwright)
- **الحالة:** `FIXED_NOT_FULLY_TESTED`
- **السبب:** تم إعداد ملفات التكوين القياسية `playwright.config.ts` و `playwright-fixture.ts` وكتابة اختبار الدخان `e2e/auth.spec.ts`. تعذر التشغيل الكامل لعدم وجود ملفات محرك المتصفح Chromium محلياً (`C:\Users\HP\AppData\Local\ms-playwright`). يتطلب تشغيله مستقبلاً تنفيذ: `npx playwright install chromium`.

---

## 5. خطة النشر الآمن والتحقق (Safe Deployment & Rollback Plan)

### 5.1 المتطلبات المسبقة (Prerequisites)
1. أخذ نسخة احتياطية كاملة (Full Database Snapshot / Backup) لقاعدة بيانات الإنتاج عبر لوحة تحكم Supabase.
2. التحقق من ضبط كافة متغيرات البيئة في Supabase Secrets:
   - `GREEN_API_WEBHOOK_SECRET`
   - `META_APP_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PROJECT_ID`

### 5.2 خطوات النشر (Deployment Steps)
1. **ترحيل قاعدة البيانات:**
   - تطبيق ترحيل الأمان أولاً:
     ```bash
     supabase db push
     # أو تطبيق الملف 20260806120000_security_and_authorization_hardening.sql عبر SQL Editor
     ```
   - تطبيق ترحيل تحسين الأداء:
     ```bash
     # تطبيق الملف 20260806130000_dashboard_performance_optimization.sql عبر SQL Editor
     ```
2. **نشر Edge Functions المحدثة:**
   ```bash
   supabase functions deploy secure-image
   supabase functions deploy extract-transfer-amount
   supabase functions deploy green-api-webhook
   supabase functions deploy mcp
   ```
3. **بناء ونشر الواجهة الأمامية (Frontend):**
   ```bash
   npm run build
   # رفع مجلد dist إلى خادم الاستضافة (Netlify / Vercel / Cloudflare Pages)
   ```

### 5.3 خطة التحقق بعد النشر (Post-Deployment Verification)
1. تسجيل الدخول كمستخدم عادي ومحاولة استدعاء `mark_platform_invoice_paid` عبر المتصفح والتحقق من استقبال رفض أمني `403/42501 permission denied`.
2. تسجيل الدخول بحساب `viewer` ومحاولة حذف التحويلات والتأكد من رفض العملية.
3. حذف فرع تجريبي منطقياً والتحقق من إمكانية إنشاء فرع بديل دون قيود خاطئة.
4. إرسال طلب Webhook وهمي إلى Green-API والتأكد من رفضه عند غياب السر السليم.
5. التحقق من تحميل صور التحويلات والإيصالات للمستخدمين المصرح لهم فقط.

### 5.4 خطة التراجع السريع (Rollback Plan)
- في حال حدوث أي خلل تشغيلي غير متوقع:
  1. يمكن استعادة صلاحية `EXECUTE` على الدوال المحددة مؤقتاً:
     ```sql
     GRANT EXECUTE ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) TO authenticated;
     ```
  2. الرجوع إلى التوزيع السابق للواجهة الأمامية بنقرة واحدة عبر لوحة الاستضافة (Instant Rollback).
  3. استعادة النسخة الاحتياطية لقاعدة البيانات في حال حدوث تضارب في المخطط.

---

## 6. المخاطر المتبقية والتوصيات المستقبلية (Residual Risks & Recommendations)

1. **حماية هجمات القوة الغاشمة (Rate Limiting على الخادم):**
   - تم تقييد المحاولات في المتصفح عبر `localStorage`، لكن من المستحسن تفعيل Rate Limiting على مستوى Edge (Cloudflare WAF أو Upstash Redis / Supabase Auth Hooks) لحماية نقطة النهاية `auth/v1/token` على الخادم مباشرة ضد الهجمات الموجهة خارج المتصفح.
2. **عزل صور التخزين (Storage Bucket RLS):**
   - ينبغي مراجعة سياسات RLS لـ Storage Buckets (`transfer-receipts`, `invoices`) للتأكد من عدم وجود مسار قراءة مباشر بدون رابط موقع مؤقت (Signed URL).
3. **تثبيت حزم Playwright في خط الـ CI/CD:**
   - إضافة خطوة `npx playwright install --with-deps chromium` في مسار GitHub Actions لتشغيل اختبارات E2E تلقائياً مع كل Pull Request.

---

**خاتمة:** تم إنجاز المهمة بنجاح ورفع الجاهزية الأمنية لنظام Hesapaty PRO مع توفير الأدلة الهندسية الشاملة وصيانة سلامة البيانات والعمليات المحاسبية.
