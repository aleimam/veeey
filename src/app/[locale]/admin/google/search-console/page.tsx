import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { getGscConfig, gscConnected, redirectUri, listSitemaps, searchPerformance, inspectUrl } from '@/lib/gsc-service';
import { saveGscClientAction, connectGscAction, disconnectGscAction, submitSitemapAction } from '@/server/gsc-actions';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SearchConsolePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const cfg = await getGscConfig();
  const connected = await gscConnected();
  const todayIso = new Date().toISOString();
  const inspectTarget = one(sp.inspect);

  const [sitemaps, perf, inspection] = await Promise.all([
    connected ? listSitemaps() : Promise.resolve(null),
    connected ? searchPerformance(28, todayIso) : Promise.resolve(null),
    connected && inspectTarget ? inspectUrl(inspectTarget) : Promise.resolve(null),
  ]);

  const num = (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US');
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const date = (iso?: string) => (iso ? new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB') : '—');

  return (
    <div className="max-w-3xl p-6">
      <Link href="/admin/google" className="text-sm text-primary hover:underline">← {tb('Google services', 'خدمات Google')}</Link>
      <h1 className="mb-1 mt-2 font-heading text-xl font-semibold">{tb('Google Search Console', 'Google Search Console')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {tb('Connect your Google account to submit the sitemap automatically and read indexing + search performance in-admin.', 'اربط حساب Google لإرسال خريطة الموقع تلقائيًا وقراءة الفهرسة وأداء البحث داخل اللوحة.')}
      </p>

      {one(sp.saved) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved ✓', 'تم الحفظ ✓')}</p>}
      {one(sp.connected) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Connected to Google Search Console ✓', 'تم الربط بـ Search Console ✓')}</p>}
      {one(sp.disconnected) != null && <p className="mb-4 rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">{tb('Disconnected.', 'تم قطع الاتصال.')}</p>}
      {one(sp.submitted) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Sitemap submitted ✓', 'تم إرسال خريطة الموقع ✓')}</p>}
      {one(sp.submitfail) != null && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Sitemap submit failed', 'فشل إرسال خريطة الموقع')} ({one(sp.submitfail)})</p>}
      {one(sp.error) != null && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Error', 'خطأ')}: {one(sp.error)}</p>}

      {/* Connection status */}
      <section className="mb-8 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${connected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {connected ? tb('✓ Connected', '✓ متصل') : tb('Not connected', 'غير متصل')}
            </span>
            <p className="mt-1 text-sm text-muted-foreground">{tb('Property:', 'الموقع:')} <span dir="ltr">{cfg.property}</span></p>
          </div>
          <div className="flex gap-2">
            {cfg.clientId && !connected && (
              <form action={connectGscAction}><input type="hidden" name="locale" value={locale} />
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Connect Google', 'ربط Google')}</button>
              </form>
            )}
            {connected && (
              <>
                <form action={submitSitemapAction}><input type="hidden" name="locale" value={locale} />
                  <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Submit sitemap now', 'إرسال خريطة الموقع الآن')}</button>
                </form>
                <form action={disconnectGscAction}><input type="hidden" name="locale" value={locale} />
                  <button className="rounded-md border border-border px-3 py-2 text-sm text-destructive hover:bg-surface">{tb('Disconnect', 'قطع الاتصال')}</button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Sitemap status */}
      {connected && sitemaps && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Sitemaps', 'خرائط الموقع')}</h2>
          {sitemaps.ok ? (
            sitemaps.sitemaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tb('No sitemaps submitted yet — press “Submit sitemap now”.', 'لم تُرسَل أي خريطة بعد — اضغط «إرسال خريطة الموقع الآن».')}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-xs uppercase text-muted-foreground">
                    <tr><th className="p-3 text-start">{tb('Sitemap', 'الخريطة')}</th><th className="p-3 text-start">{tb('Last submitted', 'آخر إرسال')}</th><th className="p-3 text-start">{tb('Submitted / Indexed', 'المُرسَل / المُفهرَس')}</th><th className="p-3 text-start">{tb('Issues', 'مشاكل')}</th></tr>
                  </thead>
                  <tbody>
                    {sitemaps.sitemaps.map((s) => (
                      <tr key={s.path} className="border-t border-border">
                        <td className="p-3" dir="ltr"><span className="text-xs">{s.path.replace(/^https?:\/\/[^/]+/, '')}</span></td>
                        <td className="p-3 text-muted-foreground">{date(s.lastSubmitted)}{s.isPending ? ` · ${tb('pending', 'قيد المعالجة')}` : ''}</td>
                        <td className="p-3">{s.submitted != null ? `${num(Number(s.submitted))} / ${num(Number(s.indexed ?? 0))}` : '—'}</td>
                        <td className="p-3">{Number(s.errors ?? 0) > 0 ? <span className="text-destructive">{num(Number(s.errors))} {tb('errors', 'أخطاء')}</span> : Number(s.warnings ?? 0) > 0 ? <span className="text-gold">{num(Number(s.warnings))} {tb('warnings', 'تحذيرات')}</span> : <span className="text-primary">✓</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not read sitemaps', 'تعذّرت قراءة خرائط الموقع')}: {sitemaps.error}</p>
          )}
        </section>
      )}

      {/* Search performance */}
      {connected && perf && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Search performance (28 days)', 'أداء البحث (28 يومًا)')}</h2>
          {perf.ok && perf.data ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [tb('Clicks', 'النقرات'), num(Math.round(perf.data.totals.clicks))],
                  [tb('Impressions', 'الظهور'), num(Math.round(perf.data.totals.impressions))],
                  [tb('Avg CTR', 'متوسط النقر'), pct(perf.data.totals.ctr)],
                  [tb('Avg position', 'متوسط الترتيب'), perf.data.totals.position.toFixed(1)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-semibold text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              {perf.data.topQueries.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-surface text-xs uppercase text-muted-foreground">
                      <tr><th className="p-3 text-start">{tb('Query', 'الاستعلام')}</th><th className="p-3 text-end">{tb('Clicks', 'نقرات')}</th><th className="p-3 text-end">{tb('Impr.', 'ظهور')}</th><th className="p-3 text-end">{tb('CTR', 'CTR')}</th><th className="p-3 text-end">{tb('Pos.', 'ترتيب')}</th></tr>
                    </thead>
                    <tbody>
                      {perf.data.topQueries.map((r) => (
                        <tr key={r.keys.join()} className="border-t border-border">
                          <td className="p-3" dir="ltr">{r.keys[0]}</td>
                          <td className="p-3 text-end">{num(Math.round(r.clicks))}</td>
                          <td className="p-3 text-end">{num(Math.round(r.impressions))}</td>
                          <td className="p-3 text-end">{pct(r.ctr)}</td>
                          <td className="p-3 text-end">{r.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="rounded-md bg-gold/15 px-3 py-2 text-sm text-slate">{tb('No performance data yet (or the property has no history).', 'لا توجد بيانات أداء بعد (أو لا يوجد سجل لهذا الموقع).')} {perf.error ? `(${perf.error})` : ''}</p>
          )}
        </section>
      )}

      {/* URL inspection */}
      {connected && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Inspect a URL', 'فحص رابط')}</h2>
          <form className="flex flex-wrap items-end gap-2">
            <input name="inspect" defaultValue={inspectTarget ?? ''} placeholder="https://veeey.com/en/products/…" className={`${inputCls} w-96`} dir="ltr" />
            <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Inspect', 'فحص')}</button>
          </form>
          {inspection && (
            inspection.ok ? (
              <div className="mt-3 rounded-lg border border-border p-3 text-sm">
                <p>{tb('Verdict:', 'النتيجة:')} <span className="font-medium">{inspection.verdict ?? '—'}</span></p>
                <p className="text-muted-foreground">{tb('Coverage:', 'التغطية:')} {inspection.coverageState ?? '—'} · {tb('Last crawl:', 'آخر زحف:')} {date(inspection.lastCrawl)}</p>
              </div>
            ) : (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{inspection.error}</p>
            )
          )}
        </section>
      )}

      {/* OAuth client setup */}
      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg font-semibold">{tb('OAuth client', 'عميل OAuth')}</h2>
        <form action={saveGscClientAction} className="space-y-4 rounded-lg border border-border p-4">
          <input type="hidden" name="locale" value={locale} />
          <label className="block text-sm font-medium">{tb('Property (as in Search Console)', 'الموقع (كما في Search Console)')}
            <input name="property" defaultValue={cfg.property} className={inputCls} dir="ltr" />
          </label>
          <label className="block text-sm font-medium">{tb('OAuth client ID', 'معرّف عميل OAuth')}
            <input name="clientId" defaultValue={cfg.clientId} autoComplete="off" className={inputCls} dir="ltr" />
          </label>
          <label className="block text-sm font-medium">{tb('OAuth client secret', 'سرّ عميل OAuth')}
            <input name="clientSecret" type="password" autoComplete="new-password" placeholder={cfg.clientSecret ? '•••••••• ' + tb('(stored — blank keeps it)', '(مُخزَّن — اتركه فارغًا للإبقاء)') : ''} className={inputCls} dir="ltr" />
          </label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Save OAuth client', 'حفظ عميل OAuth')}</button>
        </form>
      </section>

      {/* Setup instructions */}
      <section className="rounded-lg border border-dashed border-border bg-surface/50 p-4 text-sm text-muted-foreground">
        <h3 className="mb-2 font-semibold text-foreground">{tb('One-time setup', 'إعداد لمرة واحدة')}</h3>
        <ol className="list-inside list-decimal space-y-1">
          <li>{tb('In Google Cloud Console → APIs & Services, enable the “Google Search Console API”.', 'في Google Cloud Console ← واجهات البرمجة، فعّل «Google Search Console API».')}</li>
          <li>{tb('Create an OAuth 2.0 Client ID (type: Web application).', 'أنشئ معرّف عميل OAuth 2.0 (النوع: تطبيق ويب).')}</li>
          <li>{tb('Add this exact Authorized redirect URI:', 'أضِف رابط إعادة التوجيه المصرّح به بالضبط:')} <code className="rounded bg-surface px-1" dir="ltr">{redirectUri()}</code></li>
          <li>{tb('Paste the Client ID + Secret above and Save, then press “Connect Google”.', 'الصق معرّف العميل والسرّ بالأعلى واحفظ، ثم اضغط «ربط Google».')}</li>
          <li>{tb('Your Google account must own the Search Console property above.', 'يجب أن يملك حساب Google موقع Search Console المذكور بالأعلى.')}</li>
        </ol>
      </section>
    </div>
  );
}
