import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';
import { Icon } from '@/components/storefront/ui/icon';
import { IlloTile } from '@/components/storefront/chewy/illustration';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'فيي تعلّم — عافيتك مشروحة — Veeey' : 'Veeey Learn — Your wellness, explained — Veeey',
    description:
      locale === 'ar'
        ? 'أدلّة مُراجعة صيدلانيًا حول الحالات والمكوّنات والأجهزة — ليكون كل اختيار قائمًا على معرفة.'
        : 'Pharmacist-reviewed guides on conditions, ingredients and devices — so every choice you make is an informed one.',
  };
}

const FALLBACK = [
  { tag: ['Gut Health', 'صحة الأمعاء'], t: ['The complete guide to a healthy gut microbiome', 'الدليل الكامل لميكروبيوم أمعاء صحّي'], read: ['8 min read', 'قراءة ٨ دقائق'], illo: 'leaf', slug: '' },
  { tag: ['Ingredient', 'مكوّن'], t: ['Vitamin D3 & K2: why they work better together', 'فيتامين د٣ وك٢: لماذا يعملان معًا أفضل'], read: ['6 min read', 'قراءة ٦ دقائق'], illo: 'shield', slug: '' },
  { tag: ['Sleep', 'النوم'], t: ['Magnesium for sleep: forms, timing and dosage', 'المغنيسيوم للنوم: الأشكال والتوقيت والجرعة'], read: ['5 min read', 'قراءة ٥ دقائق'], illo: 'moon', slug: '' },
] as const;

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = pick(locale);

  let posts: { title: string; slug: string; tag: string; illo: string }[] = [];
  try {
    const rows = await prisma.blogPost.findMany({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' }, take: 3 });
    const illos = ['leaf', 'shield', 'moon'];
    posts = rows.map((p, i) => ({
      title: (locale === 'ar' ? p.titleAr : p.titleEn) ?? p.titleEn,
      slug: p.slug,
      tag: t('Guide', 'دليل'),
      illo: illos[i % illos.length],
    }));
  } catch {
    posts = [];
  }
  const whatsapp = await getSetting('store.whatsappNumber');
  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}` : null;

  const hubs = [
    { icon: 'stethoscope', t: ['Health Conditions', 'الحالات الصحية'], s: ['Evidence-based guides on common concerns — immunity, gut, sleep, heart and more.', 'أدلّة قائمة على الأدلّة حول الشواغل الشائعة — المناعة والأمعاء والنوم والقلب وغيرها.'], count: ['32 guides', '٣٢ دليلًا'], tint: 'var(--green-wash)' },
    { icon: 'flask-conical', t: ['Ingredients Encyclopedia', 'موسوعة المكوّنات'], s: ["What each active does, the research behind it, dosing and who it's for.", 'ما يفعله كل مكوّن نشط والبحث وراءه والجرعة ولمن.'], count: ['120+ entries', '+١٢٠ مدخلًا'], tint: 'var(--lime-wash)' },
    { icon: 'book-open', t: ['Supplement Guides', 'أدلّة المكمّلات'], s: ['How to choose, stack and time supplements for your specific goal.', 'كيف تختار وتجمع وتوقّت المكمّلات لهدفك المحدّد.'], count: ['24 guides', '٢٤ دليلًا'], tint: 'var(--green-wash)' },
    { icon: 'heart-pulse', t: ['Medical Device Guides', 'أدلّة الأجهزة الطبية'], s: ['Set-up, accuracy and care for home monitors and recovery devices.', 'الإعداد والدقّة والعناية لأجهزة المراقبة المنزلية وأجهزة التعافي.'], count: ['18 guides', '١٨ دليلًا'], tint: '#E9EEF4' },
  ] as const;

  const featured = posts.length
    ? posts.map((p) => ({ tag: p.tag, title: p.title, read: t('Read article', 'اقرأ المقال'), illo: p.illo, slug: p.slug }))
    : FALLBACK.map((f) => ({ tag: t(f.tag[0], f.tag[1]), title: t(f.t[0], f.t[1]), read: t(f.read[0], f.read[1]), illo: f.illo, slug: f.slug }));

  return (
    <div>
      {/* hero */}
      <section className="border-b border-[color:var(--green-dark-05)]" style={{ background: 'linear-gradient(135deg, var(--green-wash), #fff 70%)' }}>
        <div className="mx-auto max-w-[1440px] px-4 pb-14 pt-16 text-center sm:px-6 lg:px-8">
          <div className="text-[12.5px] font-bold uppercase tracking-[0.16em] text-green-mid">{t('Veeey Learn', 'فيي تعلّم')}</div>
          <h1 className="mt-[18px] text-[clamp(38px,5vw,58px)] font-bold leading-[1.05] text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>
            {t('Your wellness, explained.', 'عافيتك، مشروحة.')}
          </h1>
          <p className="mx-auto mt-[18px] max-w-[580px] text-[18px] leading-relaxed text-[color:var(--text-muted)]">
            {t('Pharmacist-reviewed guides on conditions, ingredients and devices — so every choice you make is an informed one.', 'أدلّة مُراجعة صيدلانيًا حول الحالات والمكوّنات والأجهزة — ليكون كل اختيار قائمًا على معرفة.')}
          </p>
          <form action={`/${locale}/search`} className="mx-auto mt-[30px] flex h-[54px] max-w-[520px] items-center overflow-hidden rounded-full border border-[color:var(--slate-border)] bg-white ps-[22px] shadow-[var(--shadow-sm)]">
            <Icon name="search" size={20} color="var(--text-subtle)" />
            <input
              name="q"
              type="search"
              placeholder={t('Search a condition, ingredient or device…', 'ابحث عن حالة أو مكوّن أو جهاز…')}
              className="w-full border-none bg-transparent px-3 text-[15px] text-slate outline-none"
              aria-label={t('Search', 'بحث')}
            />
            <button type="submit" className="h-full bg-green-dark px-6 text-sm font-semibold text-white">{t('Search', 'بحث')}</button>
          </form>
        </div>
      </section>

      {/* hubs */}
      <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-2">
          {hubs.map((h) => (
            <Link
              key={h.t[0]}
              href="/blog"
              className="flex items-start gap-5 rounded-[20px] border border-[color:var(--green-dark-05)] bg-white px-7 py-6 transition-shadow hover:border-green-dark hover:shadow-[var(--shadow-md)]"
            >
              <span className="inline-flex size-[60px] shrink-0 items-center justify-center rounded-[16px]" style={{ background: h.tint }}>
                <Icon name={h.icon} size={30} color="var(--green-dark)" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-[23px] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>{t(h.t[0], h.t[1])}</h3>
                  <span className="rounded-full bg-green-wash px-2.5 py-1 text-[11.5px] font-bold text-green-mid">{t(h.count[0], h.count[1])}</span>
                </div>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--text-muted)]">{t(h.s[0], h.s[1])}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-green-dark">
                  {t('Explore', 'استكشف')} <Icon name="arrow-right" size={16} color="var(--green-dark)" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* featured guides */}
      <section className="mx-auto max-w-[1440px] px-4 pb-4 pt-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-[clamp(26px,3.2vw,36px)] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('Featured guides', 'أدلّة مختارة')}</h2>
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-bold text-green-dark hover:text-lime-press">
            {t('All articles', 'كل المقالات')} <Icon name="arrow-right" size={16} color="var(--green-dark)" />
          </Link>
        </div>
        <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((a, i) => (
            <Link
              key={i}
              href={a.slug ? `/blog/${a.slug}` : '/blog'}
              className="overflow-hidden rounded-[18px] border border-[color:var(--green-dark-05)] bg-white transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <div className="flex h-[150px] items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--green-wash), var(--lime-wash))' }}>
                <IlloTile name={a.illo} size={96} />
              </div>
              <div className="px-[22px] pb-6 pt-5">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-green-mid">{a.tag}</span>
                <h3 className="mt-2.5 text-[20px] font-bold leading-tight text-ink" style={{ fontFamily: 'var(--font-display)' }}>{a.title}</h3>
                <div className="mt-3.5 flex items-center gap-1.5 text-[13px] text-[color:var(--text-subtle)]">
                  <Icon name="clock" size={14} color="var(--text-subtle)" /> {a.read}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ask a pharmacist CTA */}
      <section className="mx-auto max-w-[1440px] px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-[24px] bg-green-dark p-[clamp(28px,4vw,48px)]">
          <div className="flex items-center gap-5">
            <span className="inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-white/12">
              <Icon name="messages-square" size={30} color="var(--lime)" />
            </span>
            <div>
              <h3 className="text-[clamp(22px,2.6vw,30px)] font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{t('Still have a question?', 'لا يزال لديك سؤال؟')}</h3>
              <p className="mt-1.5 text-[15px] text-white/75">{t('Chat free with a Veeey pharmacist, 24/7.', 'تحدّث مجانًا مع صيدلي فيي، على مدار الساعة.')}</p>
            </div>
          </div>
          {waHref ? (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="v-btn v-btn--primary v-btn--lg">{t('Talk to an expert', 'تحدّث إلى خبير')}</a>
          ) : (
            <Link href="/special-order" className="v-btn v-btn--primary v-btn--lg">{t('Talk to an expert', 'تحدّث إلى خبير')}</Link>
          )}
        </div>
      </section>
    </div>
  );
}
