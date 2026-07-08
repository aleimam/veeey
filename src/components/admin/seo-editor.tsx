'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { analyzeSeo, titlePixels, descPixels, TITLE_PX_LIMIT, DESC_PX_LIMIT } from '@/lib/seo-analyzer';
import { inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

/**
 * RankMath/Yoast-style SEO module for the product form (FR-SEO-07), bilingual
 * EN + AR. Renders INSIDE the product <form>: every input carries its field
 * name, so saving the product persists the whole module. Live analysis reads
 * the rest of the form (name, slug, long description) straight from the DOM on
 * a short interval — the rich editors write into hidden inputs, which fire no
 * events.
 */

export type SeoDefaults = {
  focusKeywordEn?: string; focusKeywordAr?: string;
  secondaryKeywordsEn?: string; secondaryKeywordsAr?: string;
  metaTitleEn?: string; metaTitleAr?: string;
  metaDescEn?: string; metaDescAr?: string;
  aiSummaryEn?: string; aiSummaryAr?: string;
  ogTitleEn?: string; ogTitleAr?: string;
  ogDescEn?: string; ogDescAr?: string;
  ogImage?: string;
  canonicalUrl?: string;
  robotsIndex?: boolean; robotsFollow?: boolean;
  schemaOverrides?: string; // JSON text
};

export type SchemaInfo = {
  name: string; brand?: string; priceEgp?: number; inStock?: boolean;
  ratingAvg?: number | null; ratingCount?: number; image?: string;
};

export type SeoEntity = 'product' | 'brand' | 'category';

/** Where the live analysis reads the rest of the form from (input names) and
 *  how the public URL is built. Per entity — Products keep their original map. */
const ENTITY_CONF: Record<SeoEntity, { nameEn: string; nameAr: string; slugEn: string; slugAr: string; contentEn: string; contentAr: string; hideFeeds?: string; pathPrefix: string }> = {
  product: { nameEn: 'nameEn', nameAr: 'nameAr', slugEn: 'slugEn', slugAr: 'slugAr', contentEn: 'longDescEn', contentAr: 'longDescAr', hideFeeds: 'restrictHideFeeds', pathPrefix: 'products' },
  brand: { nameEn: 'nameEn', nameAr: 'nameAr', slugEn: 'slug', slugAr: 'slugAr', contentEn: 'descriptionEn', contentAr: 'descriptionAr', pathPrefix: 'brands' },
  category: { nameEn: 'nameEn', nameAr: 'nameAr', slugEn: 'slug', slugAr: 'slugAr', contentEn: 'descriptionEn', contentAr: 'descriptionAr', pathPrefix: 'products?category=' },
};

type Lang = 'en' | 'ar';

const readForm = (name: string): string => {
  if (typeof document === 'undefined') return '';
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
  return el?.value ?? '';
};
const readCheck = (name: string): boolean => {
  if (typeof document === 'undefined') return false;
  const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  return !!el?.checked;
};

const dotCls = { pass: 'bg-[color:var(--green,#38764d)]', warn: 'bg-amber-500', fail: 'bg-destructive' } as const;

function Counter({ value, px, pxLimit, min, max }: { value: string; px: number; pxLimit: number; min: number; max: number }) {
  const len = value.trim().length;
  const color = len === 0 ? 'text-muted-foreground' : len >= min && len <= max && px <= pxLimit ? 'text-[color:var(--green,#38764d)]' : (len >= min * 0.6 && len <= max * 1.15 && px <= pxLimit * 1.05) ? 'text-amber-600' : 'text-destructive';
  return <span className={`text-[11px] font-medium ${color}`}>{len} ch · ~{px}/{pxLimit}px</span>;
}

export function SeoEditor({ d = {}, schemaInfo, baseUrl = 'https://veeey.com', entity = 'product' }: { d?: SeoDefaults; schemaInfo: SchemaInfo; baseUrl?: string; entity?: SeoEntity }) {
  const tb = pick(useLocale());
  const conf = ENTITY_CONF[entity];
  const [lang, setLang] = useState<Lang>('en');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Own fields (controlled; all submit with the parent form).
  const [f, setF] = useState({
    focusKeywordEn: d.focusKeywordEn ?? '', focusKeywordAr: d.focusKeywordAr ?? '',
    secondaryKeywordsEn: d.secondaryKeywordsEn ?? '', secondaryKeywordsAr: d.secondaryKeywordsAr ?? '',
    metaTitleEn: d.metaTitleEn ?? '', metaTitleAr: d.metaTitleAr ?? '',
    metaDescEn: d.metaDescEn ?? '', metaDescAr: d.metaDescAr ?? '',
    aiSummaryEn: d.aiSummaryEn ?? '', aiSummaryAr: d.aiSummaryAr ?? '',
    ogTitleEn: d.ogTitleEn ?? '', ogTitleAr: d.ogTitleAr ?? '',
    ogDescEn: d.ogDescEn ?? '', ogDescAr: d.ogDescAr ?? '',
    ogImage: d.ogImage ?? '',
    canonicalUrl: d.canonicalUrl ?? '',
    schemaOverrides: d.schemaOverrides ?? '',
  });
  const [robotsIndex, setRobotsIndex] = useState(d.robotsIndex ?? true);
  const [robotsFollow, setRobotsFollow] = useState(d.robotsFollow ?? true);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  // AI-translate pushes values via the veeey:rich-set event (controlled inputs
  // can't be written from the DOM) — accept any of our own field names.
  useEffect(() => {
    const handler = (e: Event) => {
      const det = (e as CustomEvent<{ name: string; html: string }>).detail;
      if (!det) return;
      setF((s) => (det.name in s ? { ...s, [det.name]: det.html } : s));
    };
    window.addEventListener('veeey:rich-set', handler);
    return () => window.removeEventListener('veeey:rich-set', handler);
  }, []);

  // Live context from the rest of the form (poll — hidden inputs fire no events).
  const [ext, setExt] = useState({ nameEn: '', nameAr: '', slugEn: '', slugAr: '', longEn: '', longAr: '', hideFeeds: false });
  useEffect(() => {
    const readAll = () => setExt({
      nameEn: readForm(conf.nameEn), nameAr: readForm(conf.nameAr),
      slugEn: readForm(conf.slugEn), slugAr: readForm(conf.slugAr),
      longEn: readForm(conf.contentEn), longAr: readForm(conf.contentAr),
      hideFeeds: conf.hideFeeds ? readCheck(conf.hideFeeds) : false,
    });
    readAll();
    const t = setInterval(readAll, 2500);
    return () => clearInterval(t);
  }, [conf]);

  const L = lang === 'en';
  const name = (L ? ext.nameEn : ext.nameAr) || ext.nameEn;
  const slug = (L ? ext.slugEn : ext.slugAr) || ext.slugEn || entity;
  const title = (L ? f.metaTitleEn : f.metaTitleAr) || name;
  const metaDesc = L ? f.metaDescEn : f.metaDescAr;
  const keyword = L ? f.focusKeywordEn : f.focusKeywordAr;
  const content = L ? ext.longEn : ext.longAr;
  const url = conf.pathPrefix.includes('?')
    ? `${baseUrl}/${lang}/${conf.pathPrefix}${slug}`
    : `${baseUrl}/${lang}/${conf.pathPrefix}/${slug}`;

  const analysis = useMemo(
    () => analyzeSeo({ keyword, title, metaDesc, slug, contentHtml: content }),
    [keyword, title, metaDesc, slug, content],
  );
  const scoreColor = analysis.grade === 'good' ? 'bg-[color:var(--green,#38764d)]' : analysis.grade === 'ok' ? 'bg-amber-500' : 'bg-destructive';

  const CHECK_LABELS: Record<string, [string, string]> = {
    kw_title: ['Keyword in SEO title', 'الكلمة في عنوان SEO'],
    kw_meta: ['Keyword in meta description', 'الكلمة في وصف الميتا'],
    kw_slug: ['Keyword in URL slug', 'الكلمة في الرابط'],
    kw_first_para: ['Keyword in first paragraph', 'الكلمة في الفقرة الأولى'],
    kw_subheading: ['Keyword in a subheading', 'الكلمة في عنوان فرعي'],
    kw_alt: ['Keyword in image alt', 'الكلمة في نص بديل لصورة'],
    title_len: ['SEO title length', 'طول عنوان SEO'],
    meta_len: ['Meta description length', 'طول وصف الميتا'],
    density: ['Keyword density', 'كثافة الكلمة المفتاحية'],
    content_len: ['Content length', 'طول المحتوى'],
    links: ['Internal / external links', 'روابط داخلية / خارجية'],
    readability: ['Readability', 'سهولة القراءة'],
  };

  // Structured data: auto schema (per entity type) + overrides preview.
  const autoSchema = useMemo(() => {
    const img = f.ogImage || schemaInfo.image || undefined;
    if (entity === 'brand') {
      return { '@context': 'https://schema.org', '@type': 'Brand', name: schemaInfo.name || name, logo: img, url };
    }
    if (entity === 'category') {
      return { '@context': 'https://schema.org', '@type': 'CollectionPage', name: schemaInfo.name || name, image: img, url };
    }
    return {
      '@context': 'https://schema.org', '@type': 'Product',
      name: schemaInfo.name || name, brand: schemaInfo.brand ? { '@type': 'Brand', name: schemaInfo.brand } : undefined,
      image: img,
      offers: { '@type': 'Offer', priceCurrency: 'EGP', price: schemaInfo.priceEgp ?? 0, availability: schemaInfo.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
      ...((schemaInfo.ratingCount ?? 0) > 0 && schemaInfo.ratingAvg ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: schemaInfo.ratingAvg, reviewCount: schemaInfo.ratingCount } } : {}),
    };
  }, [schemaInfo, name, f.ogImage, entity, url]);
  const [schemaErr, setSchemaErr] = useState('');
  const mergedSchema = useMemo(() => {
    if (!f.schemaOverrides.trim()) return autoSchema;
    try {
      const o = JSON.parse(f.schemaOverrides);
      return { ...autoSchema, ...o };
    } catch {
      return autoSchema;
    }
  }, [autoSchema, f.schemaOverrides]);

  const ogTitle = (L ? f.ogTitleEn : f.ogTitleAr) || title;
  const ogDesc = (L ? f.ogDescEn : f.ogDescAr) || metaDesc;
  const ogImg = f.ogImage || schemaInfo.image;

  const hid = (n: string, v: string) => <input type="hidden" name={n} value={v} />;

  return (
    <fieldset className="rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium">{tb('SEO (RankMath-style)', 'تحسين محركات البحث (SEO)')}</legend>

      {/* Hidden mirrors for fields edited on the OTHER language tab so both submit. */}
      {lang === 'ar' && (<>{hid('focusKeywordEn', f.focusKeywordEn)}{hid('secondaryKeywordsEn', f.secondaryKeywordsEn)}{hid('metaTitleEn', f.metaTitleEn)}{hid('metaDescEn', f.metaDescEn)}{hid('aiSummaryEn', f.aiSummaryEn)}{hid('ogTitleEn', f.ogTitleEn)}{hid('ogDescEn', f.ogDescEn)}</>)}
      {lang === 'en' && (<>{hid('focusKeywordAr', f.focusKeywordAr)}{hid('secondaryKeywordsAr', f.secondaryKeywordsAr)}{hid('metaTitleAr', f.metaTitleAr)}{hid('metaDescAr', f.metaDescAr)}{hid('aiSummaryAr', f.aiSummaryAr)}{hid('ogTitleAr', f.ogTitleAr)}{hid('ogDescAr', f.ogDescAr)}</>)}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-md border border-border p-0.5 text-sm">
          {(['en', 'ar'] as Lang[]).map((l) => (
            <button key={l} type="button" onClick={() => setLang(l)} className={`rounded px-3 py-1 ${lang === l ? 'bg-primary text-primary-foreground' : 'hover:bg-surface'}`}>
              {l === 'en' ? 'English' : 'العربية'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tb('SEO score', 'نتيجة SEO')}</span>
          <span className={`inline-flex size-10 items-center justify-center rounded-full text-sm font-bold text-white ${scoreColor}`}>{analysis.score}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: fields */}
        <div className="space-y-3">
          <label className="block text-sm font-medium">{tb('Focus keyword', 'الكلمة المفتاحية الرئيسية')}
            <input name={L ? 'focusKeywordEn' : 'focusKeywordAr'} value={keyword} onChange={set(L ? 'focusKeywordEn' : 'focusKeywordAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} placeholder={tb('e.g. vitamin d3', 'مثل: فيتامين د')} />
          </label>
          <label className="block text-sm font-medium">{tb('Secondary keywords (comma-separated)', 'كلمات ثانوية (مفصولة بفواصل)')}
            <input name={L ? 'secondaryKeywordsEn' : 'secondaryKeywordsAr'} value={L ? f.secondaryKeywordsEn : f.secondaryKeywordsAr} onChange={set(L ? 'secondaryKeywordsEn' : 'secondaryKeywordsAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            <span className="flex items-center justify-between">{tb('SEO title', 'عنوان SEO')}<Counter value={title} px={titlePixels(title)} pxLimit={TITLE_PX_LIMIT} min={30} max={60} /></span>
            <input name={L ? 'metaTitleEn' : 'metaTitleAr'} value={L ? f.metaTitleEn : f.metaTitleAr} onChange={set(L ? 'metaTitleEn' : 'metaTitleAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} placeholder={name} />
          </label>
          <label className="block text-sm font-medium">
            <span className="flex items-center justify-between">{tb('Meta description', 'وصف الميتا')}<Counter value={metaDesc} px={descPixels(metaDesc)} pxLimit={DESC_PX_LIMIT} min={120} max={160} /></span>
            <textarea name={L ? 'metaDescEn' : 'metaDescAr'} rows={3} value={metaDesc} onChange={set(L ? 'metaDescEn' : 'metaDescAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} />
          </label>
          {entity === 'product' && (
            <label className="block text-sm font-medium">{tb('AI summary (AEO)', 'ملخص الذكاء الاصطناعي (AEO)')}
              <textarea name={L ? 'aiSummaryEn' : 'aiSummaryAr'} rows={2} value={L ? f.aiSummaryEn : f.aiSummaryAr} onChange={set(L ? 'aiSummaryEn' : 'aiSummaryAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} />
            </label>
          )}
        </div>

        {/* Right: snippet preview + checks */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">{tb('Google preview', 'معاينة Google')}</span>
              <div className="flex gap-1 text-xs">
                {(['desktop', 'mobile'] as const).map((dv) => (
                  <button key={dv} type="button" onClick={() => setDevice(dv)} className={`rounded px-2 py-0.5 ${device === dv ? 'bg-surface font-medium' : 'text-muted-foreground'}`}>
                    {dv === 'desktop' ? tb('Desktop', 'حاسوب') : tb('Mobile', 'جوال')}
                  </button>
                ))}
              </div>
            </div>
            <div className={`${device === 'mobile' ? 'max-w-[360px]' : 'max-w-[600px]'} rounded bg-white p-3 shadow-sm`} dir={L ? 'ltr' : 'rtl'}>
              <p className="truncate text-xs text-[#202124]">{url}</p>
              <p className="truncate text-[18px] leading-snug text-[#1a0dab]" style={{ maxWidth: device === 'mobile' ? 340 : TITLE_PX_LIMIT }}>{title || tb('(no title)', '(بدون عنوان)')}</p>
              <p className="line-clamp-2 text-[13px] leading-snug text-[#4d5156]">{metaDesc || tb('Meta description preview appears here.', 'تظهر معاينة وصف الميتا هنا.')}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{tb('SEO analysis', 'تحليل SEO')} — {analysis.score}/100</p>
            <ul className="space-y-1.5">
              {analysis.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-xs">
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${dotCls[c.status]}`} />
                  <span>
                    <span className="font-medium">{tb(...(CHECK_LABELS[c.id] ?? [c.id, c.id]))}</span>
                    <span className="text-muted-foreground"> — {c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Social meta */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">{tb('Social (Open Graph + Twitter)', 'الوسوم الاجتماعية (OG + تويتر)')}</p>
          <label className="block text-sm font-medium">{tb('OG title', 'عنوان OG')}
            <input name={L ? 'ogTitleEn' : 'ogTitleAr'} value={L ? f.ogTitleEn : f.ogTitleAr} onChange={set(L ? 'ogTitleEn' : 'ogTitleAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} placeholder={title} />
          </label>
          <label className="block text-sm font-medium">{tb('OG description', 'وصف OG')}
            <textarea name={L ? 'ogDescEn' : 'ogDescAr'} rows={2} value={L ? f.ogDescEn : f.ogDescAr} onChange={set(L ? 'ogDescEn' : 'ogDescAr')} dir={L ? 'ltr' : 'rtl'} className={inputCls} placeholder={metaDesc} />
          </label>
          <label className="block text-sm font-medium">{tb('OG image URL (defaults to first product image)', 'رابط صورة OG (افتراضيًا أول صورة للمنتج)')}
            <input name="ogImage" value={f.ogImage} onChange={set('ogImage')} className={inputCls} />
          </label>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{tb('Share preview', 'معاينة المشاركة')}</p>
          <div className="max-w-[420px] overflow-hidden rounded-lg border border-border" dir={L ? 'ltr' : 'rtl'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {ogImg ? <img src={ogImg} alt="" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center bg-surface text-xs text-muted-foreground">{tb('No image', 'بدون صورة')}</div>}
            <div className="space-y-0.5 bg-card p-2.5">
              <p className="text-[11px] uppercase text-muted-foreground">veeey.com</p>
              <p className="truncate text-sm font-semibold">{ogTitle || tb('(no title)', '(بدون عنوان)')}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{ogDesc}</p>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">{tb('Used for both Open Graph (Facebook/WhatsApp) and the Twitter large-image card.', 'تُستخدم لوسوم Open Graph (فيسبوك/واتساب) وبطاقة تويتر الكبيرة.')}</p>
        </div>
      </div>

      {/* Structured data + indexing */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{tb('Structured data (Product schema)', 'البيانات المنظمة (مخطط المنتج)')}</p>
          <textarea
            name="schemaOverrides"
            rows={4}
            value={f.schemaOverrides}
            onChange={(e) => { setF((s) => ({ ...s, schemaOverrides: e.target.value })); if (e.target.value.trim()) { try { JSON.parse(e.target.value); setSchemaErr(''); } catch { setSchemaErr(tb('Invalid JSON — overrides will be ignored until fixed.', 'JSON غير صالح — سيتم تجاهل التعديلات حتى إصلاحه.')); } } else setSchemaErr(''); }}
            placeholder='{ "description": "…", "sku": "…" }'
            className={`${inputCls} font-mono text-xs`}
            dir="ltr"
          />
          {schemaErr && <p className="mt-1 text-xs text-destructive">{schemaErr}</p>}
          <pre className="mt-2 max-h-44 overflow-auto rounded bg-surface p-2 text-[11px] leading-relaxed" dir="ltr">{JSON.stringify(mergedSchema, null, 2)}</pre>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">{tb('Indexing', 'الفهرسة')}</p>
          <label className="block text-sm font-medium">{tb('Canonical URL (leave empty for the default product URL)', 'الرابط القياسي (اتركه فارغًا للرابط الافتراضي)')}
            <input name="canonicalUrl" value={f.canonicalUrl} onChange={set('canonicalUrl')} className={inputCls} placeholder={url} dir="ltr" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="robotsIndex" checked={robotsIndex} onChange={(e) => setRobotsIndex(e.target.checked)} className="size-4" />
            {tb('Allow indexing (index)', 'السماح بالفهرسة (index)')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="robotsFollow" checked={robotsFollow} onChange={(e) => setRobotsFollow(e.target.checked)} className="size-4" />
            {tb('Follow links (follow)', 'تتبع الروابط (follow)')}
          </label>
          {!robotsIndex && <p className="text-xs text-amber-600">⚠ {tb('This product will be excluded from Google results.', 'سيتم استبعاد هذا المنتج من نتائج Google.')}</p>}
          {ext.hideFeeds && (
            <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              {tb('"Hide from Google/Meta feeds" is ON (Restriction settings) — this product is already excluded from the shopping feeds; the robots settings above control the product PAGE.', 'خيار «إخفاء من خلاصات Google/Meta» مفعّل — المنتج مستبعد من خلاصات التسوق؛ إعدادات robots أعلاه تتحكم في صفحة المنتج نفسها.')}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
