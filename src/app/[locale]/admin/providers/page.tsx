import { setRequestLocale } from 'next-intl/server';
import { getSmtpFormValues, emailConfigured } from '@/lib/provider-config-service';
import { saveSmtpConfigAction, clearSmtpConfigAction, sendTestEmailAction } from '@/server/provider-actions';
import { inputCls } from '@/components/admin/ui';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProvidersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const [smtp, configured] = await Promise.all([getSmtpFormValues(), emailConfigured()]);
  const test = one(sp.test);

  return (
    <div className="p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold">Providers</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Email (SMTP) settings. Credentials are stored securely and never shown again after saving; leave the password blank to keep the current one. SMS &amp; WhatsApp are added separately.
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
    </div>
  );
}
