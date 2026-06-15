import { setRequestLocale } from 'next-intl/server';
import { getSmtpFormValues, emailConfigured, getAiFormValues, aiConfigured, getSmsFormValues, smsConfigured, getWhatsappFormValues, getOpayFormValues, opayConfigured, getKashierFormValues, kashierConfigured } from '@/lib/provider-config';
import { saveSmtpConfigAction, clearSmtpConfigAction, sendTestEmailAction, saveAiConfigAction, clearAiConfigAction, saveSmsConfigAction, clearSmsConfigAction, sendTestSmsAction, saveWhatsappConfigAction, clearWhatsappConfigAction, saveOpayConfigAction, clearOpayConfigAction, saveKashierConfigAction, clearKashierConfigAction } from '@/server/provider-actions';
import { inputCls } from '@/components/admin/ui';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProvidersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [smtp, configured, ai, aiOn, sms, smsOn, wa, opay, opayOn, kashier, kashierOn] = await Promise.all([
    getSmtpFormValues(), emailConfigured(), getAiFormValues(), aiConfigured(), getSmsFormValues(), smsConfigured(), getWhatsappFormValues(),
    getOpayFormValues(), opayConfigured(), getKashierFormValues(), kashierConfigured(),
  ]);
  const test = one(sp.test);
  const smsTest = one(sp.smstest);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://veeey.com').replace(/\/$/, '');

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">المزوّدون</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        بيانات اعتماد البريد والذكاء الاصطناعي والرسائل القصيرة وWhatsApp &amp; بوابات الدفع. تُخزَّن الأسرار بشكل آمن ولا تُعرض مرة أخرى بعد الحفظ — اترك كلمة المرور/الرمز فارغًا للإبقاء على القيمة الحالية.
      </p>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">تم الحفظ.</p>}
      {one(sp.cleared) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">تم مسح إعدادات SMTP.</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">تعذّر الحفظ.</p>}
      {test === 'ok' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">تم إرسال بريد الاختبار.</p>}
      {test === 'fail' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">فشل الاختبار — راجع إعدادات SMTP.</p>}
      {test === 'skipped' && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">لا يوجد مزوّد بريد مُهيّأ بعد.</p>}

      <section className="max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">البريد (SMTP)</h2>
        <p className="mb-4 text-sm text-muted-foreground">الحالة: {configured ? '✓ مُهيّأ' : '— غير مُهيّأ (يُسجَّل البريد على أنه متخطّى)'}</p>

        <form action={saveSmtpConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">المضيف
              <input name="host" defaultValue={smtp.host} placeholder="smtp.example.com" className={inputCls} />
            </label>
            <label className="text-sm font-medium">المنفذ
              <input name="port" type="number" defaultValue={smtp.port} placeholder="587" className={inputCls} />
            </label>
            <label className="text-sm font-medium">اسم المستخدم
              <input name="user" defaultValue={smtp.user} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">كلمة المرور
              <input name="pass" type="password" autoComplete="new-password" placeholder={smtp.hasPass ? '•••••••• (مُخزَّنة — اتركها فارغة للإبقاء عليها)' : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">البريد المُرسِل
              <input name="from" defaultValue={smtp.from} placeholder="info@veeey.com" className={inputCls} />
            </label>
            <label className="text-sm font-medium">اسم المُرسِل
              <input name="fromName" defaultValue={smtp.fromName} placeholder="Veeey" className={inputCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="secure" defaultChecked={smtp.secure} /> استخدام TLS/SSL (آمن)</label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ إعدادات البريد</button>
        </form>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={sendTestEmailAction} className="flex items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">إرسال اختبار إلى
              <input name="to" type="email" required placeholder="you@example.com" className={`${inputCls} w-64`} />
            </label>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">إرسال اختبار</button>
          </form>
          <form action={clearSmtpConfigAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">مسح إعدادات SMTP</button>
          </form>
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">الذكاء الاصطناعي (Claude)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          يشغّل مسوّدات الاختبارات وملخّصات المراجعات. الحالة: {aiOn ? '✓ مُفعّل' : '— مُعطّل (تعمل الميزات بدون ذكاء اصطناعي)'}.
        </p>
        <form action={saveAiConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">مفتاح API
            <input name="apiKey" type="password" autoComplete="new-password" placeholder={ai.hasKey ? '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)' : 'sk-ant-…'} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">النموذج
            <input name="model" defaultValue={ai.model} placeholder={ai.defaultModel} className={inputCls} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">الافتراضي: {ai.defaultModel}</span>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={ai.enabled} /> تفعيل ميزات الذكاء الاصطناعي</label>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ إعدادات الذكاء الاصطناعي</button>
          </div>
        </form>
        <form action={clearAiConfigAction} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">مسح إعدادات الذكاء الاصطناعي</button>
        </form>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">الرسائل القصيرة SMS (sms.com.eg / SMSMisr)</h2>
        <p className="mb-4 text-sm text-muted-foreground">الحالة: {smsOn ? '✓ مُهيّأ' : '— غير مُهيّأ'}. ستجد اسم المستخدم وكلمة مرور API &amp; رمز المُرسِل في لوحة تحكم SMSMisr ← الإعدادات.</p>
        {smsTest === 'ok' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">تم إرسال رسالة الاختبار.</p>}
        {smsTest === 'fail' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">فشل إرسال رسالة الاختبار — راجع بيانات الاعتماد/المُرسِل.</p>}
        {smsTest === 'skipped' && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">الرسائل القصيرة غير مُهيّأة بعد.</p>}

        <form action={saveSmsConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">البيئة
              <select name="environment" defaultValue={sms.environment} className={inputCls}>
                <option value="2">اختبار</option>
                <option value="1">مباشر</option>
              </select>
            </label>
            <label className="text-sm font-medium">اللغة
              <select name="language" defaultValue={sms.language} className={inputCls}>
                <option value="1">الإنجليزية</option>
                <option value="2">العربية</option>
                <option value="3">Unicode</option>
              </select>
            </label>
            <label className="text-sm font-medium">اسم مستخدم API
              <input name="username" defaultValue={sms.username} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">كلمة مرور API
              <input name="password" type="password" autoComplete="new-password" placeholder={sms.hasPass ? '•••••••• (مُخزَّنة — اتركها فارغة للإبقاء عليها)' : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium sm:col-span-2">رمز المُرسِل
              <input name="sender" defaultValue={sms.sender} placeholder="رمز مُعرّف المُرسِل" className={inputCls} />
            </label>
          </div>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ إعدادات الرسائل القصيرة</button>
        </form>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={sendTestSmsAction} className="flex items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">إرسال اختبار إلى
              <input name="to" required placeholder="01XXXXXXXXX" className={`${inputCls} w-56`} />
            </label>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">إرسال رسالة اختبار</button>
          </form>
          <form action={clearSmsConfigAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">مسح إعدادات الرسائل القصيرة</button>
          </form>
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">WhatsApp</h2>
        <p className="mb-4 text-sm text-muted-foreground">احفظ بيانات اعتمادك الآن؛ <em>إرسال</em> WhatsApp يتم ربطه في خطوة لاحقة (المزوّد لم يُحدَّد بعد).</p>
        <form action={saveWhatsappConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">المُرسِل / مُعرّف رقم الهاتف
            <input name="sender" defaultValue={wa.sender} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">رمز API
            <input name="token" type="password" autoComplete="new-password" placeholder={wa.hasToken ? '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)' : ''} className={inputCls} />
          </label>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ إعدادات WhatsApp</button>
            <button formAction={clearWhatsappConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">مسح</button>
          </div>
        </form>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">المدفوعات — OPay (البطاقات)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          دفع مُستضاف بالبطاقة (Visa / MasterCard). الحالة: {opayOn ? '✓ مُهيّأ' : '— غير مُهيّأ'}. ستجد هذه في لوحة تحكم تاجر OPay ← مفاتيح API. أبقِ <strong>البيئة</strong> على Sandbox حتى تنتقل إلى التشغيل المباشر.
        </p>
        <form action={saveOpayConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">البيئة
              <select name="environment" defaultValue={opay.environment} className={inputCls}>
                <option value="sandbox">Sandbox</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="text-sm font-medium">مُعرّف التاجر
              <input name="merchantId" defaultValue={opay.merchantId} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">المفتاح العام
              <input name="publicKey" defaultValue={opay.publicKey} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">المفتاح الخاص (السرّي)
              <input name="privateKey" type="password" autoComplete="new-password" placeholder={opay.hasPrivate ? '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)' : ''} className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ إعدادات OPay</button>
            <button formAction={clearOpayConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">مسح</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">في لوحة تحكم OPay اضبط رابط رد النداء/الويب هوك على <code className="rounded bg-surface px-1">{site}/api/payments/webhook/opay</code>. تستخدم طريقة البطاقة البوابة المختارة في الإعدادات ← المدفوعات (الافتراضي: تلقائي).</p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">المدفوعات — Kashier (البطاقات)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          دفع مُستضاف بالبطاقة (Visa / MasterCard). الحالة: {kashierOn ? '✓ مُهيّأ' : '— غير مُهيّأ'}. ستجد هذه في لوحة تحكم Kashier ← الإعدادات ← API. يوقّع <strong>مفتاح API للدفع</strong> عملية الدفع؛ ويتحقّق <strong>المفتاح السرّي</strong> من الويب هوك. أبقِ <strong>البيئة</strong> على Test حتى تنتقل إلى التشغيل المباشر.
        </p>
        <form action={saveKashierConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">البيئة
              <select name="environment" defaultValue={kashier.environment} className={inputCls}>
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="text-sm font-medium">مُعرّف التاجر (MID)
              <input name="merchantId" defaultValue={kashier.merchantId} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">مفتاح API للدفع
              <input name="apiKey" type="password" autoComplete="new-password" placeholder={kashier.hasApiKey ? '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)' : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">المفتاح السرّي (الويب هوك)
              <input name="secretKey" type="password" autoComplete="new-password" placeholder={kashier.hasSecret ? '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)' : ''} className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">حفظ إعدادات Kashier</button>
            <button formAction={clearKashierConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">مسح</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">في لوحة تحكم Kashier اضبط رابط الويب هوك على <code className="rounded bg-surface px-1">{site}/api/payments/webhook/kashier</code>. تستخدم طريقة البطاقة البوابة المختارة في الإعدادات ← المدفوعات (الافتراضي: تلقائي).</p>
      </section>
    </div>
  );
}
