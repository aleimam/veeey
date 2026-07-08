import { headers } from 'next/headers';
import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { getGoogleConfig } from '@/lib/google-service';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { saveGoogleAction } from '@/server/google-actions';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const card = 'rounded-xl border border-border bg-card p-4';
const labelCls = 'flex flex-col gap-1 text-sm font-medium text-foreground';

export default async function AdminGooglePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requirePermission('settings.manage');
  const tb = pick(locale);
  const cfg = await getGoogleConfig();
  const saved = (Array.isArray(sp.saved) ? sp.saved[0] : sp.saved) === '1';

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'veeey.com';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const feedUrl = `${proto}://${host}/feeds/google.xml`;

  return (
    <div className="p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Google services', 'خدمات Google')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tb('Connect Google Analytics, Tag Manager and Search Console. Paste the ids below — the tags load on the storefront automatically.', 'اربط Google Analytics و Tag Manager و Search Console. الصق المعرّفات بالأسفل — تُحمَّل الوسوم تلقائيًا على المتجر.')}
        </p>
      </header>

      {saved && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved ✓', 'تم الحفظ ✓')}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form action={saveGoogleAction} className={`${card} space-y-4`}>
          <input type="hidden" name="locale" value={locale} />
          <label className={labelCls}>
            {tb('GA4 Measurement ID', 'معرّف قياس GA4')}
            <input name="ga4Id" defaultValue={cfg.ga4Id} placeholder="G-XXXXXXXXXX" className={inputCls} />
            <span className="text-xs font-normal text-muted-foreground">{tb('Google Analytics 4 → Admin → Data streams.', 'من Google Analytics 4 ← الإدارة ← تدفقات البيانات.')}</span>
          </label>
          <label className={labelCls}>
            {tb('Tag Manager container ID', 'معرّف حاوية Tag Manager')}
            <input name="gtmId" defaultValue={cfg.gtmId} placeholder="GTM-XXXXXXX" className={inputCls} />
          </label>
          <label className={labelCls}>
            {tb('Search Console verification', 'تحقّق Search Console')}
            <input name="searchConsole" defaultValue={cfg.searchConsole} placeholder='content token or the whole <meta> tag' className={inputCls} />
            <span className="text-xs font-normal text-muted-foreground">{tb('Use the “HTML tag” method; paste the token or the entire meta tag.', 'استخدم طريقة «وسم HTML»؛ الصق الرمز أو وسم meta كاملًا.')}</span>
          </label>
          <label className={labelCls}>
            {tb('Google Ads conversion ID (optional)', 'معرّف تحويل Google Ads (اختياري)')}
            <input name="adsId" defaultValue={cfg.adsId} placeholder="AW-XXXXXXXXX" className={inputCls} />
          </label>
          <label className={labelCls}>
            {tb('Tag loading', 'تحميل الوسوم')}
            <select name="consentMode" defaultValue={cfg.consentMode} className={inputCls}>
              <option value="gated">{tb('Only after full cookie consent (default)', 'فقط بعد الموافقة الكاملة على ملفات الارتباط (افتراضي)')}</option>
              <option value="always">{tb('Always — Consent Mode v2 (denied until visitor accepts)', 'دائمًا — وضع الموافقة v2 (مرفوض حتى يقبل الزائر)')}</option>
            </select>
            <span className="text-xs font-normal text-muted-foreground">
              {tb('"Always" loads GA4/GTM for every visitor with Google Consent Mode defaults set to denied (no cookies or identifiers), upgrading automatically when the visitor accepts — better conversion modeling, still privacy-safe.', '«دائمًا» يحمّل GA4/GTM لكل زائر مع ضبط وضع الموافقة على «مرفوض» (بدون ملفات ارتباط أو معرّفات)، ويُرقّى تلقائيًا عند قبول الزائر — قياس أفضل مع الحفاظ على الخصوصية.')}
            </span>
          </label>
          <button className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">{tb('Save', 'حفظ')}</button>
        </form>

        <aside className="space-y-4">
          <div className={card}>
            <h2 className="mb-1.5 text-sm font-semibold text-foreground">{tb('Merchant Center feed', 'خلاصة Merchant Center')}</h2>
            <p className="mb-2 text-xs text-muted-foreground">{tb('A product feed is already generated. Add it as a scheduled feed in Google Merchant Center:', 'يتم إنشاء خلاصة المنتجات بالفعل. أضِفها كخلاصة مجدولة في Google Merchant Center:')}</p>
            <code className="block break-all rounded bg-surface p-2 font-mono text-xs text-foreground">{feedUrl}</code>
          </div>
          <div className={`${card} text-xs leading-relaxed text-muted-foreground`}>
            <p className="mb-1 font-semibold text-foreground">{tb('Notes', 'ملاحظات')}</p>
            <p>{tb('By default GA4 & Tag Manager load only after a visitor accepts cookies. Switch "Tag loading" to Always for Consent Mode v2 (loads for everyone, denied until accepted). Search Console verification loads for everyone.', 'افتراضيًا يتم تحميل GA4 و Tag Manager فقط بعد قبول الزائر لملفات تعريف الارتباط. بدّل «تحميل الوسوم» إلى «دائمًا» لوضع الموافقة v2 (يُحمَّل للجميع، مرفوض حتى القبول). أما تحقّق Search Console فيُحمَّل للجميع.')}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
