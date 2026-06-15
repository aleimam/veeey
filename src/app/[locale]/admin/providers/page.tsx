import { setRequestLocale } from 'next-intl/server';
import { getSmtpFormValues, emailConfigured, getAiFormValues, aiConfigured, getSmsFormValues, smsConfigured, getWhatsappFormValues } from '@/lib/provider-config';
import { saveSmtpConfigAction, clearSmtpConfigAction, sendTestEmailAction, saveAiConfigAction, clearAiConfigAction, saveSmsConfigAction, clearSmsConfigAction, sendTestSmsAction, saveWhatsappConfigAction, clearWhatsappConfigAction } from '@/server/provider-actions';
import { inputCls } from '@/components/admin/ui';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProvidersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [smtp, configured, ai, aiOn, sms, smsOn, wa] = await Promise.all([
    getSmtpFormValues(), emailConfigured(), getAiFormValues(), aiConfigured(), getSmsFormValues(), smsConfigured(), getWhatsappFormValues(),
  ]);
  const test = one(sp.test);
  const smsTest = one(sp.smstest);

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">Providers</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Email, AI, SMS &amp; WhatsApp credentials. Secrets are stored securely and never shown again after saving — leave a password/token blank to keep the current one.
      </p>

      {one(sp.saved) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Saved.</p>}
      {one(sp.cleared) === '1' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">SMTP settings cleared.</p>}
      {one(sp.error) === '1' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Could not save.</p>}
      {test === 'ok' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Test email sent.</p>}
      {test === 'fail' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Test failed — check the SMTP settings.</p>}
      {test === 'skipped' && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">No email provider configured yet.</p>}

      <section className="max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">Email (SMTP)</h2>
        <p className="mb-4 text-sm text-muted-foreground">Status: {configured ? '✓ configured' : '— not configured (emails are recorded as skipped)'}</p>

        <form action={saveSmtpConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Host
              <input name="host" defaultValue={smtp.host} placeholder="smtp.example.com" className={inputCls} />
            </label>
            <label className="text-sm font-medium">Port
              <input name="port" type="number" defaultValue={smtp.port} placeholder="587" className={inputCls} />
            </label>
            <label className="text-sm font-medium">Username
              <input name="user" defaultValue={smtp.user} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">Password
              <input name="pass" type="password" autoComplete="new-password" placeholder={smtp.hasPass ? '•••••••• (stored — blank keeps it)' : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium">From email
              <input name="from" defaultValue={smtp.from} placeholder="info@veeey.com" className={inputCls} />
            </label>
            <label className="text-sm font-medium">From name
              <input name="fromName" defaultValue={smtp.fromName} placeholder="Veeey" className={inputCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="secure" defaultChecked={smtp.secure} /> Use TLS/SSL (secure)</label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save email settings</button>
        </form>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={sendTestEmailAction} className="flex items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">Send test to
              <input name="to" type="email" required placeholder="you@example.com" className={`${inputCls} w-64`} />
            </label>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">Send test</button>
          </form>
          <form action={clearSmtpConfigAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">Clear SMTP settings</button>
          </form>
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">AI (Claude)</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Powers quiz drafts and review summaries. Status: {aiOn ? '✓ enabled' : '— off (features run without AI)'}.
        </p>
        <form action={saveAiConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">API key
            <input name="apiKey" type="password" autoComplete="new-password" placeholder={ai.hasKey ? '•••••••• (stored — blank keeps it)' : 'sk-ant-…'} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">Model
            <input name="model" defaultValue={ai.model} placeholder={ai.defaultModel} className={inputCls} />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">Default: {ai.defaultModel}</span>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={ai.enabled} /> Enable AI features</label>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save AI settings</button>
          </div>
        </form>
        <form action={clearAiConfigAction} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">Clear AI settings</button>
        </form>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">SMS (sms.com.eg / SMSMisr)</h2>
        <p className="mb-4 text-sm text-muted-foreground">Status: {smsOn ? '✓ configured' : '— not configured'}. Find your username, API password &amp; sender token in the SMSMisr console → Settings.</p>
        {smsTest === 'ok' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Test SMS sent.</p>}
        {smsTest === 'fail' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Test SMS failed — check the credentials/sender.</p>}
        {smsTest === 'skipped' && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">SMS not configured yet.</p>}

        <form action={saveSmsConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Environment
              <select name="environment" defaultValue={sms.environment} className={inputCls}>
                <option value="2">Test</option>
                <option value="1">Live</option>
              </select>
            </label>
            <label className="text-sm font-medium">Language
              <select name="language" defaultValue={sms.language} className={inputCls}>
                <option value="1">English</option>
                <option value="2">Arabic</option>
                <option value="3">Unicode</option>
              </select>
            </label>
            <label className="text-sm font-medium">API username
              <input name="username" defaultValue={sms.username} autoComplete="off" className={inputCls} />
            </label>
            <label className="text-sm font-medium">API password
              <input name="password" type="password" autoComplete="new-password" placeholder={sms.hasPass ? '•••••••• (stored — blank keeps it)' : ''} className={inputCls} />
            </label>
            <label className="text-sm font-medium sm:col-span-2">Sender token
              <input name="sender" defaultValue={sms.sender} placeholder="Sender ID token" className={inputCls} />
            </label>
          </div>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save SMS settings</button>
        </form>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={sendTestSmsAction} className="flex items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <label className="text-sm font-medium">Send test to
              <input name="to" required placeholder="01XXXXXXXXX" className={`${inputCls} w-56`} />
            </label>
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">Send test SMS</button>
          </form>
          <form action={clearSmsConfigAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">Clear SMS settings</button>
          </form>
        </div>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="mb-1 font-heading text-lg font-semibold">WhatsApp</h2>
        <p className="mb-4 text-sm text-muted-foreground">Store your credentials now; WhatsApp <em>sending</em> is wired in a later step (provider TBD).</p>
        <form action={saveWhatsappConfigAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">Sender / phone-number ID
            <input name="sender" defaultValue={wa.sender} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">API token
            <input name="token" type="password" autoComplete="new-password" placeholder={wa.hasToken ? '•••••••• (stored — blank keeps it)' : ''} className={inputCls} />
          </label>
          <div className="flex items-center gap-3">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save WhatsApp settings</button>
            <button formAction={clearWhatsappConfigAction} className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">Clear</button>
          </div>
        </form>
      </section>
    </div>
  );
}
