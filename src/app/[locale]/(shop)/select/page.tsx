import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { Icon } from '@/components/storefront/ui/icon';
import { requireFeature } from '@/lib/feature-service';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

const GOLD = 'var(--gold-select)';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'فيي سيلكت — نختار لك الأفضل — Veeey' : 'Veeey Select — We select the best — Veeey',
    description:
      locale === 'ar'
        ? 'تشكيلة مختارة من منتجات الجمال والعافية الفاخرة — تُنتقى بعناية صيدلانية، وتُتحقّق أصالتها.'
        : 'A curated edit of prestige beauty, longevity and at-home wellness — chosen with pharmacist-level scrutiny and verified authentic.',
  };
}

export default async function SelectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireFeature('select', locale);
  const t = pick(locale);

  const categories: { icon: string; t: [string, string]; h: [string, string]; s: [string, string]; special?: boolean }[] = [
    { icon: 'sparkles', t: ['Prestige Skincare', 'عناية فاخرة'], h: ['Exceptional skincare, worth selecting', 'عناية استثنائية تستحق الاختيار'], s: ['Science-led, high-performance skincare from premium global brands — chosen for quality, credibility and visible value.', 'عناية عالية الأداء قائمة على العلم من علامات عالمية فاخرة — مختارة للجودة والمصداقية والقيمة الواضحة.'] },
    { icon: 'brush', t: ['Luxury Makeup', 'مكياج فاخر'], h: ['Makeup with a higher standard', 'مكياج بمعايير أعلى'], s: ['Prestige makeup and complexion essentials selected for finish, formulation quality and brand distinction.', 'مكياج وأساسيات بشرة فاخرة مختارة للمسة النهائية وجودة التركيبة وتميّز العلامة.'] },
    { icon: 'scan-face', t: ['At-Home Beauty Tech', 'تقنية جمال منزلية'], h: ['Beauty technology for home use', 'تقنية جمال للاستخدام المنزلي'], s: ['Premium devices for glow, tone, sculpting and routine enhancement — selected for practicality and home-use relevance.', 'أجهزة فاخرة للإشراق والنضارة والنحت وتعزيز الروتين — مختارة للعملية وملاءمة الاستخدام المنزلي.'] },
    { icon: 'heart-pulse', t: ['Longevity & Inner Beauty', 'طول العمر والجمال الداخلي'], h: ['Beauty and wellness from within', 'جمال وعافية من الداخل'], s: ['A curated edit of premium longevity, healthy-aging and beauty-from-within solutions for long-term well-being.', 'تشكيلة مختارة من حلول طول العمر والتقدّم الصحّي في العمر والجمال من الداخل لعافية طويلة الأمد.'] },
    { icon: 'moon', t: ['Recovery & Sleep Tech', 'تقنية التعافي والنوم'], h: ['Technology for better recovery', 'تقنية لتعافٍ أفضل'], s: ['Premium wellness tools selected to support recovery, comfort, sleep quality and everyday performance.', 'أدوات عافية فاخرة مختارة لدعم التعافي والراحة وجودة النوم والأداء اليومي.'] },
    { icon: 'globe', t: ['Rare Finds / Special Orders', 'مقتنيات نادرة / طلبات خاصة'], h: ['If it matters, we can help source it', 'إن كان يهمّك، نساعدك في توفيره'], s: ['Request hard-to-find premium products through Veeey’s global sourcing network.', 'اطلب المنتجات الفاخرة يصعب إيجادها عبر شبكة فيي العالمية للتوريد.'], special: true },
  ];

  const edits = [
    ['Best for glow & texture', 'الأفضل للإشراق والملمس'],
    ['Best for sculpting & tone', 'الأفضل للنحت والنضارة'],
    ['Best for recovery & sleep', 'الأفضل للتعافي والنوم'],
    ['Best for beauty from within', 'الأفضل للجمال من الداخل'],
    ['Editor & pharmacist picks', 'اختيارات المحرّر والصيدلي'],
    ['New prestige arrivals', 'وصل حديثًا من الفاخر'],
  ] as const;

  const pillars = [
    { icon: 'award', t: ['Credible brand reputation', 'سمعة علامة موثوقة'], s: ['Luxury meets efficiency', 'الفخامة تلتقي الكفاءة'] },
    { icon: 'flask-conical', t: ['Unique formulation', 'تركيبة فريدة'], s: ['Or strong device engineering', 'أو هندسة جهاز قوية'] },
    { icon: 'house', t: ['Safe, practical home use', 'استخدام منزلي آمن وعملي'], s: ['Real-world relevance', 'ملاءمة واقعية'] },
    { icon: 'shield-check', t: ['Authentic sourcing', 'توريد أصلي'], s: ['Verified, traceable origin', 'مصدر موثّق وقابل للتتبّع'] },
    { icon: 'refresh-cw', t: ['Ongoing expert review', 'مراجعة خبراء مستمرة'], s: ['Continuously re-evaluated', 'يُعاد تقييمه باستمرار'] },
  ] as const;

  return (
    <div>
      {/* hero */}
      <section className="relative overflow-hidden text-white" style={{ background: 'radial-gradient(120% 120% at 80% 0%, var(--green-deepest), var(--green-dark) 60%)' }}>
        <div className="relative z-[1] mx-auto max-w-[1440px] px-4 pb-[84px] pt-[76px] text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2.5 rounded-full px-[18px] py-2 text-[12.5px] font-bold uppercase tracking-[0.18em]" style={{ border: `1.5px solid ${GOLD}`, color: GOLD }}>
            <Icon name="crown" size={15} color={GOLD} /> {t('Veeey Select', 'فيي سيلكت')}
          </div>
          <h1 className="mt-[26px] text-[clamp(40px,5.4vw,66px)] font-bold leading-[1.04]" style={{ fontFamily: 'var(--font-display)' }}>
            {t('You Deserve More.', 'أنت تستحق المزيد.')}
            <br />
            {t('We Select the Best.', 'ونحن نختار الأفضل.')}
          </h1>
          <p className="mx-auto mt-[22px] max-w-[640px] text-[19px] leading-relaxed text-white/80">
            {t('Prestige beauty, longevity and at-home wellness — chosen with pharmacist-level scrutiny.', 'جمال فاخر وطول عمر وعافية منزلية — تُنتقى بتدقيق صيدلاني.')}
          </p>
          <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-relaxed text-white/55">
            {t('We search globally, filter rigorously, verify authenticity, and present only the products worth selecting.', 'نبحث عالميًا، ونصفّي بصرامة، ونتحقّق من الأصالة، ونقدّم فقط ما يستحق الاختيار.')}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="#select-cats" className="inline-flex h-[54px] items-center rounded-full px-[30px] text-[15.5px] font-bold" style={{ background: GOLD, color: 'var(--gold-on)', boxShadow: '0 8px 24px rgba(201,162,39,.35)' }}>
              {t('Explore the Collection', 'استكشف التشكيلة')}
            </a>
            <Link href="/special-order" className="inline-flex h-[54px] items-center rounded-full border border-white/35 bg-white/10 px-[26px] text-[15px] font-semibold text-white">
              {t('Request a Special Product', 'اطلب منتجًا خاصًا')}
            </Link>
          </div>
        </div>
      </section>

      {/* why this exists */}
      <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[820px] text-center">
          <div className="text-[12.5px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}>{t('Why this exists', 'لماذا وُجد هذا')}</div>
          <h2 className="mt-4 text-[clamp(28px,3.6vw,42px)] font-bold leading-[1.12] text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>
            {t('A better way to shop premium health and beauty', 'طريقة أفضل لتسوّق الصحة والجمال الفاخر')}
          </h2>
          <p className="mt-[18px] text-[16.5px] leading-[1.7] text-[color:var(--text-muted)]">
            {t(
              'Luxury alone is not enough. In a crowded global market, customers need confidence in what is truly worth buying. Veeey Select is our curated destination for exceptional beauty, longevity and home-wellness products — chosen for quality, credibility, formulation or engineering strength, and real-world relevance.',
              'الفخامة وحدها لا تكفي. في سوق عالمي مزدحم، يحتاج العملاء إلى الثقة فيما يستحق الشراء فعلًا. فيي سيلكت وجهتنا المختارة لمنتجات الجمال والعافية الاستثنائية — مختارة للجودة والمصداقية وقوة التركيبة أو الهندسة والملاءمة الواقعية.',
            )}
          </p>
        </div>
      </section>

      {/* categories */}
      <section id="select-cats" className="mx-auto max-w-[1440px] scroll-mt-[140px] px-4 pb-2 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => {
            const href = c.special ? '/special-order' : '/products';
            return (
              <Link
                key={c.t[0]}
                href={href}
                className="group relative overflow-hidden rounded-[20px] bg-white px-7 py-[30px] transition-shadow hover:shadow-[var(--shadow-lg)]"
                style={{ border: `1px solid ${c.special ? GOLD : 'var(--green-dark-12)'}` }}
              >
                {c.special && (
                  <span className="absolute end-4 top-4 rounded-full px-[11px] py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]" style={{ background: GOLD, color: 'var(--gold-on)' }}>
                    {t('Concierge', 'كونسيرج')}
                  </span>
                )}
                <span className="inline-flex size-[58px] items-center justify-center rounded-[16px]" style={{ background: c.special ? 'rgba(201,162,39,.12)' : 'var(--green-wash)' }}>
                  <Icon name={c.icon} size={28} color={c.special ? GOLD : 'var(--green-dark)'} />
                </span>
                <div className="mt-[18px] text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--text-subtle)]">{t(c.t[0], c.t[1])}</div>
                <h3 className="mt-2 text-[23px] font-bold leading-tight text-ink" style={{ fontFamily: 'var(--font-display)' }}>{t(c.h[0], c.h[1])}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[color:var(--text-muted)]">{t(c.s[0], c.s[1])}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: c.special ? GOLD : 'var(--green-dark)' }}>
                  {c.special ? t('Request', 'اطلب') : t('Discover', 'اكتشف')} <Icon name="arrow-right" size={16} color={c.special ? GOLD : 'var(--green-dark)'} className="rtl:rotate-180" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* featured edits */}
      <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-14 sm:px-6 lg:px-8">
        <h2 className="mb-1 text-[clamp(24px,3vw,34px)] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('Featured edits', 'تشكيلات مختارة')}</h2>
        <p className="mb-6 text-[15px] text-[color:var(--text-muted)]">{t('Curated shortcuts to the best of the collection.', 'اختصارات مختارة لأفضل ما في التشكيلة.')}</p>
        <div className="flex flex-wrap gap-3">
          {edits.map((e) => (
            <Link key={e[0]} href="/products" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--slate-border)] bg-white px-5 py-3 text-[14.5px] font-semibold text-slate transition-colors hover:text-green-dark">
              <Icon name="sparkle" size={15} color={GOLD} /> {t(e[0], e[1])}
            </Link>
          ))}
        </div>
      </section>

      {/* the Veeey standard */}
      <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] bg-green-dark p-[clamp(32px,4.5vw,60px)] text-white">
          <div className="mx-auto max-w-[640px] text-center">
            <div className="text-[12.5px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>{t('The Veeey standard', 'معيار فيي')}</div>
            <h2 className="mt-4 text-[clamp(28px,3.6vw,42px)] font-bold leading-[1.1]" style={{ fontFamily: 'var(--font-display)' }}>{t('How we select', 'كيف نختار')}</h2>
            <p className="mt-3.5 text-[16px] text-white/70">{t('Every product passes five non-negotiable pillars before it earns a place in Select.', 'يجتاز كل منتج خمس ركائز غير قابلة للتفاوض قبل أن يستحق مكانًا في سيلكت.')}</p>
          </div>
          <div className="mt-11 grid gap-[18px] sm:grid-cols-3 lg:grid-cols-5">
            {pillars.map((p) => (
              <div key={p.t[0]} className="px-1.5 text-center">
                <span className="inline-flex size-16 items-center justify-center rounded-full" style={{ border: `1.5px solid ${GOLD}`, background: 'rgba(201,162,39,.1)' }}>
                  <Icon name={p.icon} size={28} color={GOLD} />
                </span>
                <div className="mt-4 text-[15.5px] font-bold leading-tight">{t(p.t[0], p.t[1])}</div>
                <div className="mt-1.5 text-[13px] leading-snug text-white/60">{t(p.s[0], p.s[1])}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* concierge / request */}
      <section className="mx-auto max-w-[1440px] px-4 pb-[72px] pt-14 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-7 rounded-[24px] p-[clamp(28px,4vw,52px)]" style={{ border: `1.5px solid ${GOLD}`, background: 'linear-gradient(120deg, rgba(201,162,39,.06), #fff 60%)' }}>
          <div className="flex items-center gap-[22px]">
            <span className="inline-flex size-[68px] shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(201,162,39,.14)' }}>
              <Icon name="gem" size={32} color={GOLD} />
            </span>
            <div>
              <h3 className="text-[clamp(24px,3vw,34px)] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('Looking for something rare?', 'تبحث عن شيء نادر؟')}</h3>
              <p className="mt-2 max-w-[560px] text-[15.5px] leading-relaxed text-[color:var(--text-muted)]">
                {t(
                  "If the product or brand you want isn't listed, Veeey can source select beauty, wellness and healthcare products through our global operations and special-order service.",
                  'إن لم يكن المنتج أو العلامة التي تريدها مدرجة، يمكن لفيي توفير منتجات جمال وعافية ورعاية صحية مختارة عبر عملياتنا العالمية وخدمة الطلب الخاص.',
                )}
              </p>
            </div>
          </div>
          <Link href="/special-order" className="inline-flex h-[54px] shrink-0 items-center rounded-full px-[30px] text-[15.5px] font-bold" style={{ background: GOLD, color: 'var(--gold-on)', boxShadow: '0 8px 24px rgba(201,162,39,.3)' }}>
            {t('Request a Special Product', 'اطلب منتجًا خاصًا')}
          </Link>
        </div>
      </section>
    </div>
  );
}
