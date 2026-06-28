import Image from 'next/image';
import { pick } from '@/lib/admin-i18n';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';
import { btnClass } from '@/components/storefront/ui/button';
import { TierBadge } from '@/components/storefront/ui/tier-badge';
import { IlloTile } from '@/components/storefront/chewy/illustration';
import { ChewyHero, type HeroSlide } from '@/components/storefront/chewy/chewy-hero';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { RichBlock, ImageBannerBlock, ProductRowBlock, CtaBlock, TilesBlock } from '@/components/storefront/chewy/blocks/gadgets';
import type { Product } from '@/components/storefront/product-card';
import type { Block } from '@/lib/home-layout';
import type { HomeData } from '@/lib/home-layout-service';

type T = (en: string, ar: string) => string;

const GOALS = [
  { illo: 'shield', en: 'Immunity', ar: 'المناعة', href: '/products' },
  { illo: 'bolt', en: 'Energy', ar: 'الطاقة', href: '/products' },
  { illo: 'moon', en: 'Sleep', ar: 'النوم', href: '/products' },
  { illo: 'heart', en: 'Heart', ar: 'القلب', href: '/products' },
  { illo: 'leaf', en: 'Gut Health', ar: 'صحة الأمعاء', href: '/products' },
  { illo: 'sparkle', en: 'Beauty', ar: 'الجمال', href: '/products' },
  { illo: 'shield-plus', en: "Men's", ar: 'الرجال', href: '/products' },
  { illo: 'device', en: 'Devices', ar: 'الأجهزة', href: '/products?kind=DEVICE' },
];
const CATS = [
  { illo: 'bottle', en: 'Capsules & Tablets', ar: 'كبسولات وأقراص' },
  { illo: 'tub', en: 'Powders & Greens', ar: 'بودرة وخضراوات' },
  { illo: 'softgel', en: 'Softgels & Oils', ar: 'سوفت‑جيل وزيوت' },
  { illo: 'dropper', en: 'Liquids & Drops', ar: 'سوائل ونقط' },
  { illo: 'device', en: 'Health Devices', ar: 'أجهزة صحية' },
  { illo: 'tag', en: "Today's Deals", ar: 'عروض اليوم' },
];
const BRANDS = ['Vital Nutrients', 'Sports Research', 'Terra Origin', 'Tru Niagen', 'Dr. Berg', 'Designs for Health', 'Omron', 'Nutravita'];

function SectionHead({ eyebrow, title, actionHref, actionLabel }: { eyebrow?: string; title: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-green-mid">{eyebrow}</div>}
        <h2 className="text-[clamp(26px,3.4vw,34px)] font-bold text-green-dark">{title}</h2>
      </div>
      {actionHref && (
        <Link href={actionHref} className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-dark hover:text-lime-press">
          {actionLabel} <Icon name="arrow-right" size={16} color="var(--green-dark)" />
        </Link>
      )}
    </div>
  );
}

function GreetStrip({ t }: { t: T }) {
  const cards = [
    { icon: 'piggy-bank', en: 'Save 15% on your first Refill', ar: 'وفّر ١٥٪ على أول ريفيل', linkEn: 'Set up Veeey Refill', linkAr: 'فعّل فيي ريفيل', href: '/refill' },
    { icon: 'stethoscope', en: 'Free chat with a Veeey pharmacist', ar: 'استشارة مجانية مع صيدلي فيي', linkEn: 'Talk to an expert', linkAr: 'تحدّث مع خبير', href: '/p/contact' },
    { icon: 'gift', en: 'Earn points on every order', ar: 'اكسب نقاطًا مع كل طلب', linkEn: 'See loyalty tiers', linkAr: 'شاهد مستويات الولاء', href: '/p/loyalty-rewards' },
  ];
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-6 sm:px-6">
      <div className="grid items-center gap-4 rounded-[18px] border border-[color:var(--green-dark-05)] bg-white p-5 md:grid-cols-[auto_1fr_1fr_1fr]">
        <div className="flex items-center gap-4 pe-2">
          <div>
            <div className="text-2xl font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('Hey, friend!', 'أهلاً بك!')}</div>
            <div className="text-[13px] text-[color:var(--text-muted)]">{t('Sign in for member pricing', 'سجّل الدخول لأسعار الأعضاء')}</div>
          </div>
          <Link href="/login" className="v-btn v-btn--dark v-btn--sm">{t('Sign in', 'دخول')}</Link>
        </div>
        {cards.map((c) => (
          <Link key={c.en} href={c.href} className="flex items-center gap-3.5 rounded-[14px] border border-[color:var(--green-dark-05)] p-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-wash">
              <Icon name={c.icon} size={22} color="var(--green-dark)" />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold leading-snug text-ink">{t(c.en, c.ar)}</span>
              <span className="text-[13px] font-bold text-green-dark">{t(c.linkEn, c.linkAr)} →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function GoalCircles({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <h2 className="mb-5 text-[clamp(24px,3vw,30px)] font-bold text-ink">{t("What's your wellness goal today?", 'ما هدفك الصحي اليوم؟')}</h2>
      <div className="grid grid-cols-3 gap-3.5 sm:grid-cols-4 lg:grid-cols-8">
        {GOALS.map((g) => (
          <Link key={g.en} href={g.href} className="group flex flex-col items-center gap-3">
            <span className="transition-transform group-hover:scale-105">
              <IlloTile name={g.illo} size={112} />
            </span>
            <span className="text-sm font-semibold text-slate">{t(g.en, g.ar)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MembershipBanner({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-7 rounded-[20px] border border-[color:var(--green-dark-05)] bg-white p-7 shadow-[var(--shadow-sm)]">
        <span className="flex size-[76px] shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-md)]" style={{ background: 'linear-gradient(150deg,var(--green-emerald),#1c4a30)' }}>
          <Icon name="crown" size={36} color="var(--gold)" />
        </span>
        <div className="min-w-[240px] flex-1">
          <div className="mb-1.5 inline-flex"><TierBadge tier="select" /></div>
          <div className="text-[clamp(24px,3vw,32px)] font-bold leading-tight text-green-dark">{t('Free delivery & 5% rewards on everything', 'توصيل مجاني و٥٪ مكافآت على كل شيء')}</div>
          <div className="mt-1.5 text-[14.5px] text-[color:var(--text-muted)]">{t('Join Veeey Select — concierge service, early access and luminous gold perks.', 'انضم إلى فيي سيلكت — خدمة كونسيرج ووصول مبكر ومزايا ذهبية.')}</div>
        </div>
        <Link href="/select" className={btnClass('primary', 'lg')}>{t('Start free trial', 'ابدأ تجربة مجانية')}</Link>
      </div>
    </section>
  );
}

function DealRail({ t, deals, locale }: { t: T; deals: Product[]; locale: string }) {
  if (deals.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-11 sm:px-6">
      <div className="rounded-[24px] border border-[color:var(--green-dark-05)] bg-white p-7 sm:p-8">
        <SectionHead eyebrow={t('Limited time', 'لفترة محدودة')} title={t("Today's expiry deals", 'عروض الصلاحية اليوم')} actionHref="/products?offers=1" actionLabel={t('Shop all deals', 'كل العروض')} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_repeat(3,1fr)]">
          <div className="relative min-h-[300px] overflow-hidden rounded-[16px]">
            <Image src="/lifestyle/kitchen-wellness.jpg" alt="" fill sizes="(max-width:1024px) 100vw, 28vw" className="object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(35,92,60,.92), rgba(35,92,60,.1))' }} />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <div className="text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{t('Save up to 30% on near-dated lots', 'وفّر حتى ٣٠٪ على التشغيلات القريبة')}</div>
              <p className="mt-2 text-[13.5px] text-white/85">{t('Same genuine product. You save, nothing goes to waste.', 'نفس المنتج الأصلي. توفّر دون هدر.')}</p>
              <Link href="/products?offers=1" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-lime">
                {t('Shop all', 'تسوّق الكل')} <Icon name="arrow-right" size={15} color="var(--lime)" />
              </Link>
            </div>
          </div>
          {deals.slice(0, 3).map((p) => <ChewyProductCard key={p.slug} product={p} locale={locale} />)}
        </div>
      </div>
    </section>
  );
}

function CategoryTiles({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <h2 className="mb-5 text-[clamp(24px,3vw,30px)] font-bold text-ink">{t('Explore popular categories', 'استكشف الفئات الشائعة')}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {CATS.map((c) => (
          <Link key={c.en} href="/products" className="flex flex-col items-center gap-3 rounded-[18px] border border-[color:var(--green-dark-05)] bg-white px-3 py-5 text-center transition-all hover:border-green-dark hover:shadow-[var(--shadow-sm)]">
            <IlloTile name={c.illo} size={104} />
            <span className="text-[13.5px] font-semibold text-slate">{t(c.en, c.ar)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeatureBanner({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <div className="grid items-center overflow-hidden rounded-[24px] border border-[color:var(--green-dark-05)] bg-white md:grid-cols-2">
        <div className="relative min-h-[360px]">
          <Image src="/lifestyle/kitchen-wellness.jpg" alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          <div className="absolute bottom-6 start-6 flex items-center gap-3 rounded-[14px] px-4 py-3 text-white backdrop-blur" style={{ background: 'rgba(28,37,48,.55)' }}>
            <span className="flex size-10 items-center justify-center rounded-full bg-lime"><Icon name="repeat" size={20} color="var(--green-dark)" /></span>
            <div>
              <div className="text-[13px] font-bold">{t('Veeey Refill', 'فيي ريفيل')}</div>
              <div className="text-xs text-white/80">{t('Set it and forget it', 'اضبطها وانسَها')}</div>
            </div>
          </div>
        </div>
        <div className="p-8 sm:p-12">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-mid">{t('Subscribe & save', 'اشترك ووفّر')}</div>
          <h2 className="mt-3 text-[clamp(28px,3.4vw,38px)] font-bold leading-tight text-green-dark">{t('15% off your first Refill order', 'خصم ١٥٪ على أول طلب ريفيل')}</h2>
          <p className="mt-3.5 max-w-[440px] text-[15.5px] leading-relaxed text-[color:var(--text-muted)]">{t('Put your essentials on a schedule and our pharmacists keep them stocked — genuine, dated, and delivered before you run out. Pause, skip or cancel anytime.', 'ضع أساسياتك على جدول وسيبقيها صيادلتنا متوفرة — أصلية ومؤرّخة وتصلك قبل أن تنفد. أوقف أو تخطَّ أو ألغِ في أي وقت.')}</p>
          <div className="mt-6"><Link href="/refill" className={btnClass('dark', 'lg')}>{t('How Refill works', 'كيف يعمل ريفيل')}</Link></div>
        </div>
      </div>
    </section>
  );
}

function SpecialOrder({ t }: { t: T }) {
  const steps = [
    { n: 1, icon: 'search', en: 'Tell us the product', ar: 'أخبرنا بالمنتج' },
    { n: 2, icon: 'credit-card', en: 'Reserve with 25% deposit', ar: 'احجز بعربون ٢٥٪' },
    { n: 3, icon: 'globe', en: 'We buy & fly it to Egypt', ar: 'نشتريه ونشحنه لمصر', note: '~20 days' },
    { n: 4, icon: 'badge-check', en: 'Late? Automatic compensation', ar: 'تأخّر؟ تعويض تلقائي' },
  ];
  return (
    <section className="mt-10" style={{ background: 'var(--panel-dark)' }}>
      <div className="mx-auto max-w-[1000px] px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-lime">{t('Special Order', 'طلب خاص')}</div>
        <h2 className="mt-4 text-[clamp(34px,4.6vw,52px)] font-bold leading-tight text-white">{t("Can't find it? We'll bring it.", 'لا تجده؟ سنحضره لك.')}</h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-white/65">{t('Request any supplement or health device from the USA, UK or EU. We will source it and fly it to Egypt.', 'اطلب أي مكمّل أو جهاز صحي من أمريكا أو بريطانيا أو أوروبا. سنوفّره ونشحنه لمصر.')}</p>
        <div className="mt-12 grid gap-8 sm:grid-cols-4">
          {steps.map((st, idx) => (
            <div key={st.n} className="relative flex flex-col items-center px-2.5">
              {idx < steps.length - 1 && <div className="absolute start-1/2 top-8 hidden h-px w-full bg-white/15 sm:block" aria-hidden="true" />}
              <div className="relative z-[2] flex size-[66px] items-center justify-center rounded-full border-2 border-lime text-[22px] font-bold text-lime" style={{ background: 'var(--panel-dark)', boxShadow: '0 0 18px rgba(209,215,37,.4)', fontFamily: 'var(--font-display)' }}>{st.n}</div>
              <span className="mt-5"><Icon name={st.icon} size={26} color="rgba(255,255,255,.78)" /></span>
              <div className="mt-4 max-w-[170px] text-base font-semibold leading-snug text-white">{t(st.en, st.ar)}</div>
              {st.note && <div className="mt-2 text-sm font-semibold text-lime">{st.note}</div>}
            </div>
          ))}
        </div>
        <div className="mt-14"><Link href="/special-order" className={btnClass('primary', 'lg')}>{t('Start a special order', 'ابدأ طلبًا خاصًا')}</Link></div>
      </div>
    </section>
  );
}

function BestSellers({ t, items, locale }: { t: T; items: Product[]; locale: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-11 sm:px-6">
      <SectionHead eyebrow={t('Loved by our A+++ members', 'محبوب من أعضائنا') } title={t('Best sellers', 'الأكثر مبيعًا')} actionHref="/products" actionLabel={t('View all', 'عرض الكل')} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[18px]">
        {items.slice(0, 5).map((p) => <ChewyProductCard key={p.slug} product={p} locale={locale} />)}
      </div>
    </section>
  );
}

function BrandStrip({ t }: { t: T }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-4 pt-11 sm:px-6">
      <div className="mb-5 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{t('Trusted imported brands, sourced authentically', 'علامات مستوردة موثوقة، بمصادر أصلية')}</div>
      <div className="flex flex-wrap justify-center gap-3.5">
        {BRANDS.map((b) => (
          <span key={b} className="rounded-full border border-[color:var(--slate-border)] px-[22px] py-3 text-[17px] font-semibold text-slate" style={{ fontFamily: 'var(--font-display)' }}>{b}</span>
        ))}
      </div>
    </section>
  );
}

export function ChewyHome({ locale, blocks, data }: { locale: string; blocks: Block[]; data: HomeData }) {
  const t = pick(locale);
  const heroImgs = data.bestsellers.map((p) => p.image).filter((x): x is string => !!x);
  const pair = (a: number, b: number) => {
    const s = heroImgs.slice(a, b);
    return s.length ? s : heroImgs.slice(0, 2);
  };
  const slides: HeroSlide[] = [
    { eyebrow: t('You Deserve More', 'تستحق المزيد'), title: t('Premium wellness,\nimported with care.', 'صحة فاخرة،\nمستوردة بعناية.'), body: t('Authentic supplements and devices from the USA, UK and EU — every lot dated, every promise kept.', 'مكمّلات وأجهزة أصلية من أمريكا وبريطانيا وأوروبا — كل تشغيلة مؤرّخة، وكل وعد محفوظ.'), cta: t('Shop best sellers', 'تسوّق الأكثر مبيعًا'), href: '/products', images: pair(0, 2) },
    { eyebrow: t('Veeey Refill', 'فيي ريفيل'), title: t('Never run out.\nSave 15% on every refill.', 'لا تنفد أبدًا.\nوفّر ١٥٪ على كل ريفيل.'), body: t('Set your supplements on a schedule and we deliver on time, every time — pause or skip anytime.', 'اضبط مكمّلاتك على جدول ونوصلها في موعدها دائمًا — أوقف أو تخطَّ في أي وقت.'), cta: t('Start a Refill plan', 'ابدأ خطة ريفيل'), href: '/refill', images: pair(2, 4) },
    { eyebrow: t('Expiry transparency', 'شفافية الصلاحية'), title: t('Choose your expiry,\nchoose your price.', 'اختر الصلاحية،\nاختر السعر.'), body: t('Same genuine product, different lots. Near-dated stock costs less — you save, nothing goes to waste.', 'نفس المنتج الأصلي، تشغيلات مختلفة. الأقرب انتهاءً أرخص — توفّر دون هدر.'), cta: t('Shop expiry deals', 'تسوّق عروض الصلاحية'), href: '/products?offers=1', images: pair(0, 2) },
  ].filter((s) => s.images.length > 0);

  const renderBlock = (b: Block) => {
    if (!b.enabled) return null;
    const props = (b.props ?? {}) as Record<string, unknown>;
    switch (b.type) {
      case 'hero': return slides.length > 0 ? <ChewyHero key={b.id} slides={slides} /> : null;
      case 'greet-strip': return <GreetStrip key={b.id} t={t} />;
      case 'goals': return <GoalCircles key={b.id} t={t} />;
      case 'membership': return <MembershipBanner key={b.id} t={t} />;
      case 'deals': return <DealRail key={b.id} t={t} deals={data.deals} locale={locale} />;
      case 'categories': return <CategoryTiles key={b.id} t={t} />;
      case 'feature-banner': return <FeatureBanner key={b.id} t={t} />;
      case 'special-order': return <SpecialOrder key={b.id} t={t} />;
      case 'best-sellers': return <BestSellers key={b.id} t={t} items={data.bestsellers} locale={locale} />;
      case 'brands': return <BrandStrip key={b.id} t={t} />;
      case 'rich': return <RichBlock key={b.id} props={props} locale={locale} />;
      case 'image-banner': return <ImageBannerBlock key={b.id} props={props} locale={locale} />;
      case 'product-row': return <ProductRowBlock key={b.id} props={props} locale={locale} items={data.rows[b.id] ?? []} />;
      case 'cta': return <CtaBlock key={b.id} props={props} locale={locale} />;
      case 'tiles': return <TilesBlock key={b.id} props={props} locale={locale} />;
      default: return null;
    }
  };

  return <div>{blocks.map(renderBlock)}</div>;
}
