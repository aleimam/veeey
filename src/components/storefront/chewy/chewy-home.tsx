import { pick } from '@/lib/admin-i18n';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';
import { btnClass } from '@/components/storefront/ui/button';
import { TierBadge } from '@/components/storefront/ui/tier-badge';
import { IlloTile } from '@/components/storefront/chewy/illustration';
import { ChewyHero, type HeroSlide } from '@/components/storefront/chewy/chewy-hero';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { RichBlock, ImageBannerBlock, ProductRowBlock, CtaBlock, TilesBlock } from '@/components/storefront/chewy/blocks/gadgets';
import { builtinContent, BUILTIN_DEFAULTS } from '@/lib/home-defaults';
import { homeBlockFeature, stripDisabledHrefs, type FeatureId } from '@/lib/feature-flags';
import type { Product } from '@/components/storefront/product-card';
import type { Block, BuiltinType } from '@/lib/home-layout';
import type { HomeData, HomePost } from '@/lib/home-layout-service';

type T = (en: string, ar: string) => string;
type C = Record<string, unknown>;
const sv = (v: unknown) => (typeof v === 'string' ? v : '');
/** Resolve a bilingual `<base>En` / `<base>Ar` pair from a content object. */
const cx = (t: T, c: C, base: string) => t(sv(c[`${base}En`]), sv(c[`${base}Ar`]));

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

function GreetStrip({ t, c }: { t: T; c: C }) {
  const cards = (Array.isArray(c.cards) ? c.cards : []) as C[];
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-6 sm:px-6">
      <div className="grid items-center gap-4 rounded-[18px] border border-[color:var(--green-dark-05)] bg-white p-5 md:grid-cols-[auto_1fr_1fr_1fr]">
        <div className="flex items-center gap-4 pe-2">
          <div>
            <div className="text-2xl font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{cx(t, c, 'greetTitle')}</div>
            <div className="text-[13px] text-[color:var(--text-muted)]">{cx(t, c, 'greetSub')}</div>
          </div>
          <Link href="/login" className="v-btn v-btn--dark v-btn--sm">{t('Sign in', 'دخول')}</Link>
        </div>
        {cards.map((card, i) => (
          <Link key={i} href={sv(card.href) || '/'} className="flex items-center gap-3.5 rounded-[14px] border border-[color:var(--green-dark-05)] p-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-wash">
              <Icon name={sv(card.icon) || 'gift'} size={22} color="var(--green-dark)" />
            </span>
            <span>
              <span className="block text-[13.5px] font-semibold leading-snug text-ink">{t(sv(card.textEn), sv(card.textAr))}</span>
              <span className="text-[13px] font-bold text-green-dark">{t(sv(card.linkEn), sv(card.linkAr))} →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function GoalCircles({ t, c }: { t: T; c: C }) {
  const items = (Array.isArray(c.items) ? c.items : []) as C[];
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <h2 className="mb-5 text-[clamp(24px,3vw,30px)] font-bold text-ink">{cx(t, c, 'title')}</h2>
      <div className="grid grid-cols-3 gap-3.5 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((g, i) => (
          <Link key={i} href={sv(g.href) || '/products'} className="group flex flex-col items-center gap-3">
            <span className="transition-transform group-hover:scale-105">
              <IlloTile name={sv(g.illo) || 'bottle'} size={112} />
            </span>
            <span className="text-sm font-semibold text-slate">{t(sv(g.labelEn), sv(g.labelAr))}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MembershipBanner({ t, c }: { t: T; c: C }) {
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-7 rounded-[20px] border border-[color:var(--green-dark-05)] bg-white p-7 shadow-[var(--shadow-sm)]">
        <span className="flex size-[76px] shrink-0 items-center justify-center rounded-full shadow-[var(--shadow-md)]" style={{ background: 'linear-gradient(150deg,var(--green-emerald),#1c4a30)' }}>
          <Icon name="crown" size={36} color="var(--gold)" />
        </span>
        <div className="min-w-[240px] flex-1">
          <div className="mb-1.5 inline-flex"><TierBadge tier="select" /></div>
          <div className="text-[clamp(24px,3vw,32px)] font-bold leading-tight text-green-dark">{cx(t, c, 'heading')}</div>
          <div className="mt-1.5 text-[14.5px] text-[color:var(--text-muted)]">{cx(t, c, 'text')}</div>
        </div>
        <Link href={sv(c.href) || '/select'} className={btnClass('primary', 'lg')}>{cx(t, c, 'cta')}</Link>
      </div>
    </section>
  );
}

function DealRail({ t, c, deals, locale }: { t: T; c: C; deals: Product[]; locale: string }) {
  if (deals.length === 0) return null;
  const img = sv(c.image) || '/lifestyle/kitchen-wellness.jpg';
  const action = sv(c.actionHref) || '/products?offers=1';
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-11 sm:px-6">
      <div className="rounded-[24px] border border-[color:var(--green-dark-05)] bg-white p-7 sm:p-8">
        <SectionHead eyebrow={cx(t, c, 'eyebrow')} title={cx(t, c, 'title')} actionHref={action} actionLabel={t('Shop all deals', 'كل العروض')} />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[minmax(280px,1fr)_repeat(3,1fr)]">
          <div className="relative min-h-[300px] overflow-hidden rounded-[16px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(35,92,60,.92), rgba(35,92,60,.1))' }} />
            <div className="absolute inset-x-0 bottom-0 p-5 text-white">
              <div className="text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{cx(t, c, 'promoTitle')}</div>
              <p className="mt-2 text-[13.5px] text-white/85">{cx(t, c, 'promoText')}</p>
              <Link href={action} className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-lime">
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

function CategoryTiles({ t, c }: { t: T; c: C }) {
  const items = (Array.isArray(c.items) ? c.items : []) as C[];
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <h2 className="mb-5 text-[clamp(24px,3vw,30px)] font-bold text-ink">{cx(t, c, 'title')}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((cat, i) => (
          <Link key={i} href={sv(cat.href) || '/products'} className="flex flex-col items-center gap-3 rounded-[18px] border border-[color:var(--green-dark-05)] bg-white px-3 py-5 text-center transition-all hover:border-green-dark hover:shadow-[var(--shadow-sm)]">
            <IlloTile name={sv(cat.illo) || 'bottle'} size={104} />
            <span className="text-[13.5px] font-semibold text-slate">{t(sv(cat.labelEn), sv(cat.labelAr))}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeatureBanner({ t, c }: { t: T; c: C }) {
  const img = sv(c.image) || '/lifestyle/kitchen-wellness.jpg';
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <div className="grid items-center overflow-hidden rounded-[24px] border border-[color:var(--green-dark-05)] bg-white md:grid-cols-2">
        <div className="relative min-h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute bottom-6 start-6 flex items-center gap-3 rounded-[14px] px-4 py-3 text-white backdrop-blur" style={{ background: 'rgba(28,37,48,.55)' }}>
            <span className="flex size-10 items-center justify-center rounded-full bg-lime"><Icon name="repeat" size={20} color="var(--green-dark)" /></span>
            <div>
              <div className="text-[13px] font-bold">{t('Veeey Refill', 'فيي ريفيل')}</div>
              <div className="text-xs text-white/80">{t('Set it and forget it', 'اضبطها وانسَها')}</div>
            </div>
          </div>
        </div>
        <div className="p-8 sm:p-12">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-green-mid">{cx(t, c, 'eyebrow')}</div>
          <h2 className="mt-3 text-[clamp(28px,3.4vw,38px)] font-bold leading-tight text-green-dark">{cx(t, c, 'heading')}</h2>
          <p className="mt-3.5 max-w-[440px] text-[15.5px] leading-relaxed text-[color:var(--text-muted)]">{cx(t, c, 'text')}</p>
          <div className="mt-6"><Link href={sv(c.href) || '/refill'} className={btnClass('dark', 'lg')}>{cx(t, c, 'cta')}</Link></div>
        </div>
      </div>
    </section>
  );
}

function SpecialOrder({ t, c }: { t: T; c: C }) {
  const steps = (Array.isArray(c.steps) ? c.steps : []) as C[];
  return (
    <section className="mt-10" style={{ background: 'var(--panel-dark)' }}>
      <div className="mx-auto max-w-[1000px] px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="text-[13px] font-bold uppercase tracking-[0.16em] text-lime">{cx(t, c, 'eyebrow')}</div>
        <h2 className="mt-4 text-[clamp(34px,4.6vw,52px)] font-bold leading-tight text-white">{cx(t, c, 'heading')}</h2>
        <p className="mx-auto mt-4 max-w-[560px] text-[17px] leading-relaxed text-white/65">{cx(t, c, 'text')}</p>
        <div className="mt-12 grid gap-8 sm:grid-cols-4">
          {steps.map((st, idx) => (
            <div key={idx} className="relative flex flex-col items-center px-2.5">
              {idx < steps.length - 1 && <div className="absolute start-1/2 top-8 hidden h-px w-full bg-white/15 sm:block" aria-hidden="true" />}
              <div className="relative z-[2] flex size-[66px] items-center justify-center rounded-full border-2 border-lime text-[22px] font-bold text-lime" style={{ background: 'var(--panel-dark)', boxShadow: '0 0 18px rgba(209,215,37,.4)', fontFamily: 'var(--font-display)' }}>{idx + 1}</div>
              <span className="mt-5"><Icon name={sv(st.icon) || 'badge-check'} size={26} color="rgba(255,255,255,.78)" /></span>
              <div className="mt-4 max-w-[170px] text-base font-semibold leading-snug text-white">{t(sv(st.labelEn), sv(st.labelAr))}</div>
              {sv(st.note) && <div className="mt-2 text-sm font-semibold text-lime">{sv(st.note)}</div>}
            </div>
          ))}
        </div>
        <div className="mt-14"><Link href={sv(c.href) || '/special-order'} className={btnClass('primary', 'lg')}>{cx(t, c, 'cta')}</Link></div>
      </div>
    </section>
  );
}

function BestSellers({ t, c, items, locale }: { t: T; c: C; items: Product[]; locale: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-11 sm:px-6">
      <SectionHead eyebrow={cx(t, c, 'eyebrow')} title={cx(t, c, 'title')} actionHref={sv(c.actionHref) || '/products'} actionLabel={t('View all', 'عرض الكل')} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[18px]">
        {items.slice(0, 5).map((p) => <ChewyProductCard key={p.slug} product={p} locale={locale} />)}
      </div>
    </section>
  );
}

/** Chewy-style trust row (audit P2 6.6/9): pharmacist help, authenticity,
 *  UltraFast delivery, Refill — four icon cards under the hero. */
function TrustRow({ t, c }: { t: T; c: C }) {
  const cards = (Array.isArray(c.cards) ? c.cards : []) as C[];
  if (cards.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-6 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, i) => (
          <Link
            key={i}
            href={sv(card.href) || '/'}
            className="flex items-start gap-3.5 rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-4 transition-all hover:border-green-dark hover:shadow-[var(--shadow-sm)]"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-wash">
              <Icon name={sv(card.icon) || 'badge-check'} size={22} color="var(--green-dark)" />
            </span>
            <span>
              <span className="block text-[14.5px] font-bold text-ink">{t(sv(card.titleEn), sv(card.titleAr))}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[color:var(--text-muted)]">{t(sv(card.textEn), sv(card.textAr))}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Homepage Learn & Blog section (audit P2 6.3): latest article cards with
 *  thumbnail, pharmacist byline and date. */
function LearnBlog({ t, c, posts, locale }: { t: T; c: C; posts: HomePost[]; locale: string }) {
  if (posts.length === 0) return null;
  const fmtDate = (d: Date | null) =>
    d ? d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-11 sm:px-6">
      <SectionHead eyebrow={cx(t, c, 'eyebrow')} title={cx(t, c, 'title')} actionHref={sv(c.actionHref) || '/learn'} actionLabel={t('Explore Learn', 'استكشف تعلّم')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-[color:var(--green-dark-05)] bg-white transition-all hover:-translate-y-[3px] hover:shadow-[var(--shadow-card-hover)]">
            <span className="relative flex h-40 items-center justify-center overflow-hidden bg-green-wash">
              {p.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <Icon name="book-open" size={40} color="var(--green-mid)" />
              )}
            </span>
            <span className="flex flex-1 flex-col p-4">
              <span className="line-clamp-2 text-[15px] font-bold leading-snug text-ink group-hover:text-green-dark">{p.title}</span>
              {p.excerpt && <span className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[color:var(--text-muted)]">{p.excerpt}</span>}
              <span className="mt-auto flex items-center gap-2 pt-3 text-xs text-[color:var(--text-subtle)]">
                {p.authorName && <span className="font-semibold text-green-dark">{p.authorName}</span>}
                {p.authorName && p.publishedAt && <span aria-hidden>·</span>}
                {p.publishedAt && <span>{fmtDate(p.publishedAt)}</span>}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BrandStrip({ t, c }: { t: T; c: C }) {
  const items = (Array.isArray(c.items) ? c.items : []) as C[];
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-4 pt-11 sm:px-6">
      <div className="mb-5 text-center text-[13px] font-semibold uppercase tracking-[0.08em] text-[color:var(--text-muted)]">{cx(t, c, 'heading')}</div>
      <div className="flex flex-wrap justify-center gap-3.5">
        {items.map((b, i) => (
          <Link
            key={i}
            href={sv(b.href) || '/brands'}
            className="rounded-full border border-[color:var(--slate-border)] px-[22px] py-3 text-[17px] font-semibold text-slate transition-colors hover:border-green-dark hover:text-green-dark"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {sv(b.name)}
          </Link>
        ))}
      </div>
      <div className="mt-5 text-center">
        <Link href="/brands" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-dark hover:text-lime-press">
          {t('Explore all brands', 'استكشف كل العلامات')} <Icon name="arrow-right" size={15} color="var(--green-dark)" />
        </Link>
      </div>
    </section>
  );
}

const ALL_ON = {} as Record<FeatureId, boolean>; // empty map ⇒ nothing gated (missing key ≠ false)

export function ChewyHome({ locale, blocks, data, states = ALL_ON }: { locale: string; blocks: Block[]; data: HomeData; states?: Record<FeatureId, boolean> }) {
  const t = pick(locale);
  const heroImgs = data.bestsellers.map((p) => p.image).filter((x): x is string => !!x);
  const pair = (a: number, b: number) => {
    const s = heroImgs.slice(a, b);
    return s.length ? s : heroImgs.slice(0, 2);
  };

  const heroSlides = (props: C): HeroSlide[] => {
    const c = builtinContent('hero', props);
    const raw = (Array.isArray(c.slides) ? c.slides : []) as C[];
    return raw
      .map((sl, i) => ({
        eyebrow: t(sv(sl.eyebrowEn), sv(sl.eyebrowAr)),
        title: t(sv(sl.titleEn), sv(sl.titleAr)),
        body: t(sv(sl.bodyEn), sv(sl.bodyAr)),
        cta: t(sv(sl.ctaEn), sv(sl.ctaAr)),
        href: sv(sl.href) || '/products',
        images: sv(sl.image) ? [sv(sl.image)] : pair(i * 2, i * 2 + 2),
      }))
      .filter((s) => s.images.length > 0);
  };

  const renderBlock = (b: Block) => {
    if (!b.enabled) return null;
    // Feature gating: hide a block dedicated to a switched-off feature, and strip
    // any list item (hero slide, trust card…) that links to an off feature — even
    // when the content comes from the built-in defaults.
    const bf = homeBlockFeature(b.type);
    if (bf && states[bf] === false) return null;
    const isBuiltin = b.type in BUILTIN_DEFAULTS;
    const merged = isBuiltin ? builtinContent(b.type as BuiltinType, b.props as C) : (b.props ?? {});
    const props = stripDisabledHrefs(merged, states) as C;
    switch (b.type) {
      case 'hero': { const slides = heroSlides(props); return slides.length > 0 ? <ChewyHero key={b.id} slides={slides} /> : null; }
      case 'greet-strip': return <GreetStrip key={b.id} t={t} c={builtinContent('greet-strip', props)} />;
      case 'trust-row': return <TrustRow key={b.id} t={t} c={builtinContent('trust-row', props)} />;
      case 'goals': return <GoalCircles key={b.id} t={t} c={builtinContent('goals', props)} />;
      case 'membership': return <MembershipBanner key={b.id} t={t} c={builtinContent('membership', props)} />;
      case 'deals': return <DealRail key={b.id} t={t} c={builtinContent('deals', props)} deals={data.deals} locale={locale} />;
      case 'categories': return <CategoryTiles key={b.id} t={t} c={builtinContent('categories', props)} />;
      case 'feature-banner': return <FeatureBanner key={b.id} t={t} c={builtinContent('feature-banner', props)} />;
      case 'special-order': return <SpecialOrder key={b.id} t={t} c={builtinContent('special-order', props)} />;
      case 'best-sellers': return <BestSellers key={b.id} t={t} c={builtinContent('best-sellers', props)} items={data.bestsellers} locale={locale} />;
      case 'learn-blog': return <LearnBlog key={b.id} t={t} c={builtinContent('learn-blog', props)} posts={data.posts ?? []} locale={locale} />;
      case 'brands': return <BrandStrip key={b.id} t={t} c={builtinContent('brands', props)} />;
      case 'rich': return <RichBlock key={b.id} props={props} locale={locale} />;
      case 'image-banner': return <ImageBannerBlock key={b.id} props={props} locale={locale} />;
      case 'product-row': return <ProductRowBlock key={b.id} props={props} locale={locale} items={data.rows[b.id] ?? []} />;
      case 'cta': return <CtaBlock key={b.id} props={props} locale={locale} />;
      case 'tiles': return <TilesBlock key={b.id} props={props} locale={locale} />;
      default: return null;
    }
  };

  // Optional per-block frame: background colour + extra vertical spacing.
  const PAD: Record<string, string> = { sm: '1.5rem', md: '3rem', lg: '5rem' };
  const framed = (b: Block) => {
    const el = renderBlock(b);
    if (!el) return null;
    const st = ((b.props?._style ?? {}) as { bg?: string; spaceTop?: string; spaceBottom?: string });
    if (!st.bg && !st.spaceTop && !st.spaceBottom) return el;
    return (
      <div key={b.id} style={{ background: st.bg || undefined, paddingTop: PAD[st.spaceTop ?? ''], paddingBottom: PAD[st.spaceBottom ?? ''] }}>
        {el}
      </div>
    );
  };

  return <div>{blocks.map(framed)}</div>;
}
