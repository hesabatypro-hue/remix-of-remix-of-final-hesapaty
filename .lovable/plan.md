
## ملخص التشخيص

بعد فحص الكود الحالي، ميزة إرسال رسالة التأكيد **موجودة ومكتوبة** في `supabase/functions/process-receipt/index.ts` (الدالة `sendConfirmationMessage`)، لكنها لا تعمل عمليًا لعدة أسباب مجتمعة:

### الأسباب الجذرية

1. **المفتاح مغلق افتراضيًا (السبب الأكبر):**
   عمود `notification_enabled` في جدول `whatsapp_connections` قيمته الافتراضية `false`. `sendConfirmationMessage` تعود فورًا إذا كان مغلقًا. لا يوجد أي مؤشر واضح في الواجهة يخبر المستخدم "أنت لم تفعّل هذا".

2. **الرد لا يذهب إلى نفس القروب في أغلب الحالات (سبب تقني):**
   في `green-api-webhook`، حقل `content` في `whatsapp_messages` يخزّن `chatId:...` فقط عندما لا يوجد نص في الرسالة. لو أرسل المستخدم صورة **مع تعليق (caption)** أو أرسل الصورة بمفردها في قروب، فإن regex `chatId:([^\s]+)` في `process-receipt` يفشل → يسقط إلى `monitored_chat_id`، وإن لم يُضبَط يرسل DM إلى المرسل الفردي بدل القروب. **النتيجة: لا رسالة تظهر في القروب.**

3. **لا يوجد عمود مخصص لـ `chat_id` في `whatsapp_messages`:**
   الاعتماد على parsing من `content` هش وينكسر بسهولة.

4. **شكل الرسالة بسيط جدًا** مقارنة بالصورة المرجعية — نص عادي بدون تنسيق واتساب (`*bold*`) ولا هيكلة واضحة تشبه "بطاقة إيصال".

5. **صعوبة التشخيص:** جدول `whatsapp_notification_log` موجود لكن لا يوجد شاشة في التطبيق لعرضه، فالمستخدم لا يعرف لماذا لم تُرسل الرسالة (خطأ Green API؟ chat_id خاطئ؟ مغلق؟).

---

## الخطة (5 خطوات)

### 1) إصلاح استهداف القروب الصحيح (الأهم)

- **Migration** جديد يضيف عمود `chat_id text` إلى `whatsapp_messages` مع فهرس.
- تحديث `green-api-webhook/index.ts` ليخزّن `chatId` في العمود الجديد مباشرة (بدل حشره داخل `content`)، مع الإبقاء على الكتابة القديمة في `content` كـ fallback للتوافق.
- تحديث `meta-webhook/index.ts` بنفس المنطق (تخزين `wa_id` / `chat_id` للرسائل الواردة).
- تحديث `process-receipt/index.ts`:
  - قراءة `msg.chat_id` مباشرة بدل regex على `content`.
  - **قاعدة الأولوية الجديدة للرد:** `chat_id الوارد` → `monitored_chat_id` → DM للمرسل. القروب دائمًا يفوز.

### 2) تحسين شكل رسالة التأكيد لتشبه الصورة المرجعية

تحديث body في `sendConfirmationMessage` باستخدام تنسيق واتساب:

```
✅ *تم تسجيل الإيراد بنجاح*
━━━━━━━━━━━━━━
💰 *المبلغ:* 25,000 ج.س
👤 *المرسل:* محمد أحمد
📅 *التاريخ:* 25/05/2024
🔖 *رقم العملية:* FT24345236
━━━━━━━━━━━━━━
_تم التحليل تلقائيًا_
```

- تنسيق التاريخ إلى `DD/MM/YYYY`.
- إضافة `transaction_id` إذا توفر.
- تمرير `transaction_id` كـ argument من `processMessage` إلى `sendConfirmationMessage`.

### 3) تشغيل الميزة افتراضيًا للاتصالات الجديدة + UI أوضح

- تعديل قيمة `notification_enabled` الافتراضية إلى `true` في migration جديد (لن يمس الاتصالات القائمة إلا إذا صرّح المستخدم).
- في `WhatsAppSettings.tsx`:
  - إضافة شارة تحذير حمراء بجوار الاتصال إذا كان `notification_enabled = false` تقول: "التأكيد التلقائي معطّل — لن يستلم العميل رسالة تحليل".
  - نقل الـ Switch إلى مكان أبرز مع عنوان "🔔 إرسال إيصال تحليل تلقائي إلى نفس القروب".

### 4) شاشة سجل الإشعارات (تشخيص)

- صفحة `/whatsapp-confirmation-log` (المستخدم بالفعل عليها الآن) تُقرأ من `whatsapp_notification_log` مع فلترة حسب الاتصال والحالة (`sent` / `failed`) وعرض `error_message`.
- إضافة عمود `transfer_id` لكل صف مع رابط للتحويلة.
- زر "إعادة اختبار" يرسل رسالة تجريبية إلى القروب المُراقَب لكل اتصال.

### 5) اختبار End-to-End يدوي

- إنشاء اتصال Green API، تفعيل المفتاح، اختيار قروب مراقَب.
- إرسال إيصال بنك الخرطوم إلى القروب.
- التحقق من:
  - `whatsapp_messages.chat_id` تعبّأ صحيحًا.
  - رسالة التأكيد وصلت **إلى نفس القروب** خلال ثوانٍ.
  - `whatsapp_notification_log` سجّل صفًا بـ `status='sent'`.
- محاكاة فشل (token خاطئ) والتأكد أن الفشل يظهر في السجل بدون كسر الـ pipeline.

---

## الملفات التي ستُعدَّل

- `supabase/migrations/<new>_add_chat_id_to_messages.sql` (جديد)
- `supabase/migrations/<new>_enable_confirmation_default.sql` (جديد)
- `supabase/functions/green-api-webhook/index.ts`
- `supabase/functions/meta-webhook/index.ts`
- `supabase/functions/process-receipt/index.ts` (تحسين استهداف + شكل الرسالة)
- `src/pages/WhatsAppSettings.tsx` (شارة تحذير + UI أوضح)
- `src/pages/WhatsAppConfirmationLog.tsx` (تحسينات + زر اختبار)
- إضافة edge function صغيرة `send-test-confirmation` للاختبار اليدوي من الواجهة

## المخاطر والاعتبارات

- **تفعيل افتراضي:** إذا فعّلنا الميزة تلقائيًا لاتصالات جديدة، قد يفاجأ العملاء برسائل — سيبقى الخيار للاتصالات القائمة مغلقًا بينما الجديد يُفعَّل.
- **حدود Green API:** كل رسالة استهلاك من حصة الاشتراك؛ سنسجّل ذلك بوضوح في UI.
- **الخصوصية:** الرد في نفس القروب يعني رؤية جميع الأعضاء لمبلغ التحويلة — سنضيف ملاحظة تنبيه في الـ toggle.
