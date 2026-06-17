import { setRequestLocale } from 'next-intl/server';
import { getSmtpFormValues, emailConfigured, getAiFormValues, aiConfigured, getSmsFormValues, smsConfigured, getWhatsappFormValues, getOpayFormValues, opayConfigured, getKashierFormValues, kashierConfigured, getAramexFormValues, aramexConfigured, getSmsaFormValues, smsaConfigured } from '@/lib/provider-config';
import { saveSmtpConfigAction, clearSmtpConfigAction, sendTestEmailAction, saveAiConfigAction, clearAiConfigAction, saveSmsConfigAction, clearSmsConfigAction, sendTestSmsAction, saveWhatsappConfigAction, clearWhatsappConfigAction, saveOpayConfigAction, clearOpayConfigAction, saveKashierConfigAction, clearKashierConfigAction, saveAramexConfigAction, clearAramexConfigAction, saveSmsaConfigAction, clearSmsaConfigAction } from '@/server/provider-actions';
import { inputCls } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProvidersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const [smtp, configured, ai, aiOn, sms, smsOn, wa, opay, opayOn, kashier, kashierOn, aramex, aramexOn, smsa, smsaOn] = await Promise.all([
    getSmtpFormValues(), emailConfigured(), getAiFormValues(), aiConfigured(), getSmsFormValues(), smsConfigured(), getWhatsappFormValues(),
    getOpayFormValues(), opayConfigured(), getKashierFormValues(), kashierConfigured(),
    getAramexFormValues(), aramexConfigured(), getSmsaFormValues(), smsaConfigured(),
  ]);
  const test = one(sp.test);
  const smsTest = one(sp.smstest);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://veeey.com').replace(/\/$/, '');

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">{tb('Providers', 'المزوّدون')}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {tb('Email, AI, SMS, WhatsApp & payment gateway credentials. Secrets are stored securely and never shown again after saving — leave the password/token blank to keep the current value.', 'بيانات اعتماد البريد والذكاء الاصطناعي والرسائل القصيرة وWhatsApp & بوابات الدفع. تُخزَّن الأسرار بشكل آمن ولا تُعرض مرة أخرى بعد الحفظ — اترك كلمة المرور/الرمز فارغًا للإبقاء على القيمة الحالية.')}
      </p>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}
      {one(sp.cleared) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('SMTP settings cleared.', 'تم مسح إعدادات SMTP.')}</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Save failed.', 'تعذّر الحفظ.')}</p>}
      {test === 'ok' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Test email sent.', 'تم إرسال بريد الاختبار.')}</p>}
      {test === 'fail' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Test failed — check SMTP settings.', 'فشل الاختبار — راجع إعدادات SMTP.')}</p>}
      {test === 'skipped' && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">{tb('No email provider configured yet.', 'لا يوجد مزوّد بريد مُهيّأ بعد.')}</p>}

      <section className="max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Email (SMTP)', 'البريد (SMTP)')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{tb('Status:', 'الحالة:')} {configured ? tb('✓ configured', '✓ مُهيّأ') : tb('— not configured (email is logged as skipped)', '— غير مُهيّأ (يُسجَّل البريد على أنه متخطّى)')}</p>

        <form action={saveSmtpConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Host', 'المضيف')}
              <input name="host" defaultValue={smtp.host} placeholder="smtp.example.com" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Port', 'المنفذ')}
              <input name="port" type="number" defaultValue={smtp.port} placeholder="587" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Username', 'اسم المستخدم')}
              <input name="user" defaultValue={smtp.user} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Password', 'كلمة المرور')}
              <input name="pass" type="password" autoComplete="new-password" placeholder={smtp.hasPass ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّنة — اتركها فارغة للإبقاء عليها)') : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('From address', 'البريد المُرسِل')}
              <input name="from" defaultValue={smtp.from} placeholder="info@veeey.com" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('From name', 'اسم المُرسِل')}
              <input name="fromName" defaultValue={smtp.fromName} placeholder="Veeey" className={inputCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="secure" defaultChecked={smtp.secure} /> {tb('Use TLS/SSL (secure)', 'استخدام TLS/SSL (آمن)')}</label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save email settings', 'حفظ إعدادات البريد')}</button>
        </form>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={sendTestEmailAction} className="flex items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">{tb('Send test to', 'إرسال اختبار إلى')}
              <input name="to" type="email" required placeholder="you@example.com" className={`${inputCls} w-64`} />
            </label>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Send test', 'إرسال اختبار')}</button>
          </form>
          <form action={clearSmtpConfigAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear SMTP settings', 'مسح إعدادات SMTP')}</button>
          </form>
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('AI (Claude)', 'الذكاء الاصطناعي (Claude)')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {tb('Powers test drafts and review summaries. Status:', 'يشغّل مسوّدات الاختبارات وملخّصات المراجعات. الحالة:')} {aiOn ? tb('✓ enabled', '✓ مُفعّل') : tb('— disabled (features run without AI)', '— مُعطّل (تعمل الميزات بدون ذكاء اصطناعي)')}.
        </p>
        <form action={saveAiConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">{tb('API key', 'مفتاح API')}
            <input name="apiKey" type="password" autoComplete="new-password" placeholder={ai.hasKey ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)') : 'sk-ant-…'} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">{tb('Model', 'النموذج')}
            <input name="model" defaultValue={ai.model} placeholder={ai.defaultModel} className={inputCls} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">{tb('Default:', 'الافتراضي:')} {ai.defaultModel}</span>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={ai.enabled} /> {tb('Enable AI features', 'تفعيل ميزات الذكاء الاصطناعي')}</label>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save AI settings', 'حفظ إعدادات الذكاء الاصطناعي')}</button>
          </div>
        </form>
        <form action={clearAiConfigAction} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear AI settings', 'مسح إعدادات الذكاء الاصطناعي')}</button>
        </form>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('SMS (sms.com.eg / SMSMisr)', 'الرسائل القصيرة SMS (sms.com.eg / SMSMisr)')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{tb('Status:', 'الحالة:')} {smsOn ? tb('✓ configured', '✓ مُهيّأ') : tb('— not configured', '— غير مُهيّأ')}. {tb('Find your username, API password & sender code in the SMSMisr dashboard ← Settings.', 'ستجد اسم المستخدم وكلمة مرور API & رمز المُرسِل في لوحة تحكم SMSMisr ← الإعدادات.')}</p>
        {smsTest === 'ok' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Test message sent.', 'تم إرسال رسالة الاختبار.')}</p>}
        {smsTest === 'fail' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Test message failed — check credentials/sender.', 'فشل إرسال رسالة الاختبار — راجع بيانات الاعتماد/المُرسِل.')}</p>}
        {smsTest === 'skipped' && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">{tb('SMS not configured yet.', 'الرسائل القصيرة غير مُهيّأة بعد.')}</p>}

        <form action={saveSmsConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Environment', 'البيئة')}
              <select name="environment" defaultValue={sms.environment} className={inputCls}>
                <option value="2">{tb('Test', 'اختبار')}</option>
                <option value="1">{tb('Live', 'مباشر')}</option>
              </select>
            </label>
            <label className="text-sm font-medium">{tb('Language', 'اللغة')}
              <select name="language" defaultValue={sms.language} className={inputCls}>
                <option value="1">{tb('English', 'الإنجليزية')}</option>
                <option value="2">{tb('Arabic', 'العربية')}</option>
                <option value="3">Unicode</option>
              </select>
            </label>
            <label className="text-sm font-medium">{tb('API username', 'اسم مستخدم API')}
              <input name="username" defaultValue={sms.username} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('API password', 'كلمة مرور API')}
              <input name="password" type="password" autoComplete="new-password" placeholder={sms.hasPass ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّنة — اتركها فارغة للإبقاء عليها)') : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium sm:col-span-2">{tb('Sender code', 'رمز المُرسِل')}
              <input name="sender" defaultValue={sms.sender} placeholder={tb('Sender ID code', 'رمز مُعرّف المُرسِل')} className={inputCls} />
            </label>
          </div>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save SMS settings', 'حفظ إعدادات الرسائل القصيرة')}</button>
        </form>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={sendTestSmsAction} className="flex items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">{tb('Send test to', 'إرسال اختبار إلى')}
              <input name="to" required placeholder="01XXXXXXXXX" className={`${inputCls} w-56`} />
            </label>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Send test message', 'إرسال رسالة اختبار')}</button>
          </form>
          <form action={clearSmsConfigAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear SMS settings', 'مسح إعدادات الرسائل القصيرة')}</button>
          </form>
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">WhatsApp</h2>
        <p className="mb-4 text-sm text-muted-foreground">{tb('Save your credentials now; WhatsApp ', 'احفظ بيانات اعتمادك الآن؛ ')}<em>{tb('sending', 'إرسال')}</em>{tb(' WhatsApp is wired up in a later step (provider not yet decided).', ' WhatsApp يتم ربطه في خطوة لاحقة (المزوّد لم يُحدَّد بعد).')}</p>
        <form action={saveWhatsappConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">{tb('Sender / phone number ID', 'المُرسِل / مُعرّف رقم الهاتف')}
            <input name="sender" defaultValue={wa.sender} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">{tb('API token', 'رمز API')}
            <input name="token" type="password" autoComplete="new-password" placeholder={wa.hasToken ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
          </label>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save WhatsApp settings', 'حفظ إعدادات WhatsApp')}</button>
            <button formAction={clearWhatsappConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear', 'مسح')}</button>
          </div>
        </form>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Payments — OPay (cards)', 'المدفوعات — OPay (البطاقات)')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {tb('Hosted card payment (Visa / MasterCard). Status:', 'دفع مُستضاف بالبطاقة (Visa / MasterCard). الحالة:')} {opayOn ? tb('✓ configured', '✓ مُهيّأ') : tb('— not configured', '— غير مُهيّأ')}. {tb('Find these in the OPay merchant dashboard ← API keys. Keep ', 'ستجد هذه في لوحة تحكم تاجر OPay ← مفاتيح API. أبقِ ')}<strong>{tb('Environment', 'البيئة')}</strong>{tb(' on Sandbox until you go live.', ' على Sandbox حتى تنتقل إلى التشغيل المباشر.')}
        </p>
        <form action={saveOpayConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Environment', 'البيئة')}
              <select name="environment" defaultValue={opay.environment} className={inputCls}>
                <option value="sandbox">Sandbox</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="text-sm font-medium">{tb('Merchant ID', 'مُعرّف التاجر')}
              <input name="merchantId" defaultValue={opay.merchantId} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Public key', 'المفتاح العام')}
              <input name="publicKey" defaultValue={opay.publicKey} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Private key (secret)', 'المفتاح الخاص (السرّي)')}
              <input name="privateKey" type="password" autoComplete="new-password" placeholder={opay.hasPrivate ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save OPay settings', 'حفظ إعدادات OPay')}</button>
            <button formAction={clearOpayConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear', 'مسح')}</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">{tb('In the OPay dashboard, set the callback/webhook URL to ', 'في لوحة تحكم OPay اضبط رابط رد النداء/الويب هوك على ')}<code className="rounded bg-surface px-1">{site}/api/payments/webhook/opay</code>{tb('. The card method uses the gateway selected in Settings ← Payments (default: automatic).', '. تستخدم طريقة البطاقة البوابة المختارة في الإعدادات ← المدفوعات (الافتراضي: تلقائي).')}</p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Payments — Kashier (cards)', 'المدفوعات — Kashier (البطاقات)')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {tb('Hosted card payment (Visa / MasterCard). Status:', 'دفع مُستضاف بالبطاقة (Visa / MasterCard). الحالة:')} {kashierOn ? tb('✓ configured', '✓ مُهيّأ') : tb('— not configured', '— غير مُهيّأ')}. {tb('Find these in the Kashier dashboard ← Settings ← API. The ', 'ستجد هذه في لوحة تحكم Kashier ← الإعدادات ← API. يوقّع ')}<strong>{tb('payment API key', 'مفتاح API للدفع')}</strong>{tb(' signs the payment; the ', ' عملية الدفع؛ ويتحقّق ')}<strong>{tb('secret key', 'المفتاح السرّي')}</strong>{tb(' verifies the webhook. Keep ', ' من الويب هوك. أبقِ ')}<strong>{tb('Environment', 'البيئة')}</strong>{tb(' on Test until you go live.', ' على Test حتى تنتقل إلى التشغيل المباشر.')}
        </p>
        <form action={saveKashierConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Environment', 'البيئة')}
              <select name="environment" defaultValue={kashier.environment} className={inputCls}>
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
            <label className="text-sm font-medium">{tb('Merchant ID (MID)', 'مُعرّف التاجر (MID)')}
              <input name="merchantId" defaultValue={kashier.merchantId} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Payment API key', 'مفتاح API للدفع')}
              <input name="apiKey" type="password" autoComplete="new-password" placeholder={kashier.hasApiKey ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Secret key (webhook)', 'المفتاح السرّي (الويب هوك)')}
              <input name="secretKey" type="password" autoComplete="new-password" placeholder={kashier.hasSecret ? tb('•••••••• (stored — leave blank to keep)', '•••••••• (مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save Kashier settings', 'حفظ إعدادات Kashier')}</button>
            <button formAction={clearKashierConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear', 'مسح')}</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">{tb('In the Kashier dashboard, set the webhook URL to ', 'في لوحة تحكم Kashier اضبط رابط الويب هوك على ')}<code className="rounded bg-surface px-1">{site}/api/payments/webhook/kashier</code>{tb('. The card method uses the gateway selected in Settings ← Payments (default: automatic).', '. تستخدم طريقة البطاقة البوابة المختارة في الإعدادات ← المدفوعات (الافتراضي: تلقائي).')}</p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Shipping — Aramex', 'الشحن — Aramex')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {tb('Status', 'الحالة')}: {aramexOn ? tb('✓ configured', '✓ مُهيّأ') : tb('— not configured', '— غير مُهيّأ')}. {tb('From your Aramex account (Shipping Services API). Keep Environment on Test until you go live.', 'من حساب Aramex (واجهة خدمات الشحن). أبقِ البيئة على «اختبار» حتى الانتقال للتشغيل.')}
        </p>
        <form action={saveAramexConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Environment', 'البيئة')}
              <select name="environment" defaultValue={aramex.environment} className={inputCls}>
                <option value="test">{tb('Test', 'اختبار')}</option>
                <option value="live">{tb('Live', 'مباشر')}</option>
              </select>
            </label>
            <label className="text-sm font-medium">{tb('Username', 'اسم المستخدم')}
              <input name="username" defaultValue={aramex.username} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Password', 'كلمة المرور')}
              <input name="password" type="password" autoComplete="new-password" placeholder={aramex.hasPassword ? '•••••••• ' + tb('(stored — blank keeps it)', '(مُخزَّنة — اتركها فارغة للإبقاء عليها)') : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Account number', 'رقم الحساب')}
              <input name="accountNumber" defaultValue={aramex.accountNumber} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Account PIN', 'رقم PIN للحساب')}
              <input name="accountPin" type="password" autoComplete="new-password" placeholder={aramex.hasPin ? '•••• ' + tb('(stored — blank keeps it)', '(مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Account entity', 'كيان الحساب')}
              <input name="accountEntity" defaultValue={aramex.accountEntity} placeholder="CAI" className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Account country code', 'رمز دولة الحساب')}
              <input name="accountCountryCode" defaultValue={aramex.accountCountryCode} placeholder="EG" className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save Aramex settings', 'حفظ إعدادات Aramex')}</button>
            <button formAction={clearAramexConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear', 'مسح')}</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">{tb('Create shipments + labels and track from an order in Orders. Saving keys here readies it.', 'أنشئ الشحنات والملصقات وتتبّعها من صفحة الطلب في «الطلبات». حفظ المفاتيح هنا يجهّزها.')}</p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">{tb('Shipping — SMSA', 'الشحن — SMSA')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {tb('Status', 'الحالة')}: {smsaOn ? tb('✓ configured', '✓ مُهيّأ') : tb('— not configured', '— غير مُهيّأ')}. {tb('SMSA SOAP web service (pass key). Create shipments + labels and track from an order.', 'خدمة SMSA عبر SOAP (مفتاح المرور). أنشئ الشحنات والملصقات وتتبّعها من صفحة الطلب.')}
        </p>
        <form action={saveSmsaConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">{tb('Environment', 'البيئة')}
              <select name="environment" defaultValue={smsa.environment} className={inputCls}>
                <option value="test">{tb('Test', 'اختبار')}</option>
                <option value="live">{tb('Live', 'مباشر')}</option>
              </select>
            </label>
            <label className="text-sm font-medium">{tb('API key', 'مفتاح API')}
              <input name="apiKey" type="password" autoComplete="new-password" placeholder={smsa.hasApiKey ? '•••••••• ' + tb('(stored — blank keeps it)', '(مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">{tb('Pass key (SOAP)', 'مفتاح المرور (SOAP)')}
              <input name="passKey" type="password" autoComplete="new-password" placeholder={smsa.hasPassKey ? '•••••••• ' + tb('(stored — blank keeps it)', '(مُخزَّن — اتركه فارغًا للإبقاء عليه)') : ''} className={inputCls} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save SMSA settings', 'حفظ إعدادات SMSA')}</button>
            <button formAction={clearSmsaConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Clear', 'مسح')}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
