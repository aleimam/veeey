'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { BACKUP_PROTOCOLS, TIER_CONTENTS, formatBytes } from '@/lib/backup/backup-logic';
import type { BackupConfigView, BackupTierView, BackupRunView } from '@/lib/backup/backup-service';
import { saveBackupAction, testBackupAction, runBackupNowAction, runTierNowAction } from '@/server/backup-actions';

const FREQUENCIES = ['OFF', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
const DOW_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const TIER_LABEL: Record<string, [string, string]> = {
  HOURLY: ['Frequent', 'متكرّر'],
  DAILY: ['Daily', 'يومي'],
  WEEKLY: ['Weekly', 'أسبوعي'],
  MANUAL: ['Manual', 'يدوي'],
};

export function BackupForm({
  initial,
  initialTiers,
  runs,
}: {
  initial: BackupConfigView;
  initialTiers: BackupTierView[];
  runs: BackupRunView[];
}) {
  const t = pick(useLocale());
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [f, setF] = useState({
    enabled: initial.enabled,
    protocol: initial.protocol,
    host: initial.host ?? '',
    port: String(initial.port),
    username: initial.username ?? '',
    password: '',
    remotePath: initial.remotePath,
    notifyOnFailure: initial.notifyOnFailure,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const [tiers, setTiers] = useState(initialTiers);
  const setTier = <K extends keyof BackupTierView>(key: string, k: K, v: BackupTierView[K]) =>
    setTiers((list) => list.map((x) => (x.key === key ? { ...x, [k]: v } : x)));

  const payload = () => ({
    enabled: f.enabled,
    protocol: f.protocol,
    host: f.host,
    port: Number(f.port) || 23,
    username: f.username,
    password: f.password, // empty = keep the stored one
    remotePath: f.remotePath,
    notifyOnFailure: f.notifyOnFailure,
  });
  const tierPayload = () =>
    tiers.map((x) => ({
      key: x.key,
      enabled: x.enabled,
      frequency: x.frequency,
      everyN: Number(x.everyN) || 1,
      hourUtc: x.hourUtc,
      weekday: x.weekday,
      dayOfMonth: x.dayOfMonth,
      contents: x.contents,
      remotePath: x.remotePath,
      keepLast: Number(x.keepLast) || 0,
    }));

  const run = (label: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string; fileName?: string }>) =>
    start(async () => {
      setBusy(label);
      setMsg(null);
      await saveBackupAction(payload(), tierPayload()); // persist what is on screen first
      const r = await fn();
      setMsg({
        ok: r.ok,
        text: r.ok
          ? r.message ?? t(`Done — ${r.fileName ?? ''}`, `تم — ${r.fileName ?? ''}`)
          : r.error ?? r.message ?? t('Failed', 'فشل'),
      });
      router.refresh();
      setBusy('');
    });

  const save = () =>
    start(async () => {
      setBusy('save');
      const r = await saveBackupAction(payload(), tierPayload());
      setMsg({ ok: r.ok, text: r.ok ? t('Saved ✓', 'تم الحفظ ✓') : r.error ?? t('Failed', 'فشل') });
      if (r.ok) set('password', '');
      router.refresh();
      setBusy('');
    });

  const input = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';
  const label = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <div className="space-y-6">
      {msg && (
        <p className={`rounded-md px-3 py-2 text-sm ${msg.ok ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
          {msg.text}
        </p>
      )}

      <section className="rounded-lg border border-border p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4" checked={f.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          {t('Enable scheduled backups', 'تفعيل النسخ الاحتياطي المجدول')}
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('When off nothing runs on a schedule — you can still test and back up manually.', 'عند الإيقاف لا يعمل شيء وفق جدول — ما زال بإمكانك الاختبار والنسخ يدوياً.')}
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-medium">{t('Destination', 'الوجهة')}</h2>
        <p className="text-xs text-muted-foreground">
          {t('SFTP only — FTPS cannot reach this storage through the server firewall. A Storage Box sub-account sees its base directory as /home.', 'SFTP فقط — لا يستطيع FTPS الوصول إلى هذا التخزين عبر جدار حماية الخادم. يرى الحساب الفرعي مجلده الأساسي باسم ‎/home‎.')}
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={label}>{t('Host', 'الخادم')}</label>
            <input className={input} value={f.host} onChange={(e) => set('host', e.target.value)} placeholder="uXXXXXX-subN.your-storagebox.de" />
          </div>
          <div>
            <label className={label}>{t('Port', 'المنفذ')}</label>
            <input className={input} inputMode="numeric" value={f.port} onChange={(e) => set('port', e.target.value)} />
          </div>
          <div>
            <label className={label}>{t('Username', 'اسم المستخدم')}</label>
            <input className={input} value={f.username} onChange={(e) => set('username', e.target.value)} autoComplete="off" />
          </div>
          <div>
            <label className={label}>{t('Password', 'كلمة المرور')}</label>
            <input
              className={input}
              type="password"
              value={f.password}
              autoComplete="new-password"
              placeholder={initial.hasPassword ? t('Leave blank to keep the saved one', 'اتركها فارغة للإبقاء على المحفوظة') : ''}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>{t('Base folder', 'المجلد الأساسي')}</label>
            <input className={input} value={f.remotePath} onChange={(e) => set('remotePath', e.target.value)} placeholder="/home" />
          </div>
          <div>
            <label className={label}>{t('Protocol', 'البروتوكول')}</label>
            <select className={input} value={f.protocol} onChange={(e) => set('protocol', e.target.value)}>
              {BACKUP_PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="font-medium">{t('Backup levels', 'مستويات النسخ الاحتياطي')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Each level has its own schedule, folder and retention. Frequent levels can hold the database only — keep at least one level on Full so uploaded files are covered.', 'لكل مستوى جدوله ومجلده وسياسة احتفاظه. يمكن أن تحتوي المستويات المتكرّرة على قاعدة البيانات فقط — أبقِ مستوى واحداً على الأقل «كامل» لتغطية الملفات المرفوعة.')}
          </p>
        </div>

        {tiers.map((x) => {
          const showHour = x.frequency === 'DAILY' || x.frequency === 'WEEKLY' || x.frequency === 'MONTHLY';
          const [en, ar] = TIER_LABEL[x.key] ?? [x.key, x.key];
          return (
            <div key={x.key} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" className="size-4" checked={x.enabled} onChange={(e) => setTier(x.key, 'enabled', e.target.checked)} />
                  {t(en, ar)}
                </label>
                <div className="flex items-center gap-3">
                  {x.lastRunAt && (
                    <span className="text-xs text-muted-foreground">
                      {t('Last run', 'آخر تشغيل')}: {new Date(x.lastRunAt).toISOString().slice(0, 16).replace('T', ' ')}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(`run-${x.key}`, () => runTierNowAction(x.key))}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    {busy === `run-${x.key}` ? t('Running…', 'جارٍ التشغيل…') : t('Run now', 'شغّل الآن')}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <label className={label}>{t('Frequency', 'التكرار')}</label>
                  <select className={input} value={x.frequency} onChange={(e) => setTier(x.key, 'frequency', e.target.value)}>
                    {FREQUENCIES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label}>{t('Every', 'كل')}</label>
                  <input className={input} inputMode="numeric" value={String(x.everyN)} onChange={(e) => setTier(x.key, 'everyN', Number(e.target.value) || 1)} />
                </div>
                {showHour && (
                  <div>
                    <label className={label}>{t('Hour (UTC)', 'الساعة (UTC)')}</label>
                    <select className={input} value={x.hourUtc} onChange={(e) => setTier(x.key, 'hourUtc', Number(e.target.value))}>
                      {Array.from({ length: 24 }).map((_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                    </select>
                  </div>
                )}
                {x.frequency === 'WEEKLY' && (
                  <div>
                    <label className={label}>{t('Weekday', 'يوم الأسبوع')}</label>
                    <select className={input} value={x.weekday} onChange={(e) => setTier(x.key, 'weekday', Number(e.target.value))}>
                      {DOW_EN.map((d, i) => <option key={d} value={i}>{t(d, DOW_AR[i])}</option>)}
                    </select>
                  </div>
                )}
                {x.frequency === 'MONTHLY' && (
                  <div>
                    <label className={label}>{t('Day of month', 'يوم الشهر')}</label>
                    <select className={input} value={x.dayOfMonth} onChange={(e) => setTier(x.key, 'dayOfMonth', Number(e.target.value))}>
                      {Array.from({ length: 28 }).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={label}>{t('Contents', 'المحتويات')}</label>
                  <select className={input} value={x.contents} onChange={(e) => setTier(x.key, 'contents', e.target.value)}>
                    {TIER_CONTENTS.map((c) => (
                      <option key={c} value={c}>
                        {c === 'DB' ? t('Database only', 'قاعدة البيانات فقط') : t('Full (database + files)', 'كامل (قاعدة البيانات + الملفات)')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>{t('Folder', 'المجلد')}</label>
                  <input className={input} value={x.remotePath} onChange={(e) => setTier(x.key, 'remotePath', e.target.value)} />
                </div>
                <div>
                  <label className={label}>{t('Keep last', 'الاحتفاظ بآخر')}</label>
                  <input className={input} inputMode="numeric" value={String(x.keepLast)} onChange={(e) => setTier(x.key, 'keepLast', Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          );
        })}

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={f.notifyOnFailure} onChange={(e) => set('notifyOnFailure', e.target.checked)} />
          {t('Record an audit entry when a backup fails', 'تسجيل إدخال تدقيق عند فشل النسخ الاحتياطي')}
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {busy === 'save' ? t('Saving…', 'جارٍ الحفظ…') : t('Save', 'حفظ')}
        </button>
        <button type="button" onClick={() => run('test', testBackupAction)} disabled={pending} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
          {busy === 'test' ? t('Testing…', 'جارٍ الاختبار…') : t('Test connection', 'اختبار الاتصال')}
        </button>
        <button type="button" onClick={() => run('now', runBackupNowAction)} disabled={pending} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
          {busy === 'now' ? t('Backing up…', 'جارٍ النسخ…') : t('Back up now', 'انسخ الآن')}
        </button>
        {initial.lastTestAt && (
          <span className="text-xs text-muted-foreground">
            {t('Last test', 'آخر اختبار')}: {initial.lastTestOk ? t('OK', 'ناجح') : t('failed', 'فشل')} — {initial.lastTestMessage}
          </span>
        )}
      </div>

      <section>
        <h2 className="mb-2 font-medium">{t('History', 'السجل')}</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">{t('When (UTC)', 'الوقت (UTC)')}</th>
                <th className="px-3 py-2">{t('Level', 'المستوى')}</th>
                <th className="px-3 py-2">{t('Contents', 'المحتويات')}</th>
                <th className="px-3 py-2">{t('Size', 'الحجم')}</th>
                <th className="px-3 py-2">{t('Status', 'الحالة')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-muted-foreground">{r.startedAt.slice(0, 16).replace('T', ' ')}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.tierKey ? t(...(TIER_LABEL[r.tierKey] ?? [r.tierKey, r.tierKey])) : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.contents || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatBytes(r.sizeBytes)}</td>
                  <td className="px-3 py-2">
                    <span className={r.status === 'SUCCESS' ? 'text-primary' : r.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground'}>{r.status}</span>
                    {r.error && <span className="block text-xs text-destructive">{r.error}</span>}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-muted-foreground">{t('No backups yet.', 'لا توجد نسخ احتياطية بعد.')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
