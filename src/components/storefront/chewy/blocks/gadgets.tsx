import { Link } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { sanitizeRichHtml } from '@/lib/rich-text';
import { btnClass } from '@/components/storefront/ui/button';
import { Icon } from '@/components/storefront/ui/icon';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import type { Product } from '@/components/storefront/product-card';

/**
 * Storefront gadget blocks for the homepage builder. Each takes the block's
 * `props` (bilingual where text) + locale; `product-row` also takes resolved
 * items. Rendered server-side inside ChewyHome; rich HTML is sanitized.
 */
type Props = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const loc = (props: Props, base: string, locale: string) => s(locale === 'ar' ? props[`${base}Ar`] : props[`${base}En`]) || s(props[`${base}En`]);

export function RichBlock({ props, locale }: { props: Props; locale: string }) {
  const html = loc(props, 'html', locale);
  if (!html.trim()) return null;
  const narrow = s(props.width) === 'narrow';
  return (
    <section className="mx-auto px-4 pb-2 pt-8 sm:px-6" style={{ maxWidth: narrow ? 820 : 1440 }}>
      <div className="veeey-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} />
    </section>
  );
}

export function ImageBannerBlock({ props, locale }: { props: Props; locale: string }) {
  const img = s(props.imageUrl);
  if (!img) return null;
  const heading = loc(props, 'heading', locale);
  const text = loc(props, 'text', locale);
  const cta = loc(props, 'ctaLabel', locale);
  const href = s(props.href) || '/products';
  const hasOverlay = !!(heading || text || cta);
  const body = (
    <div className="relative min-h-[280px] overflow-hidden rounded-[24px] border border-[color:var(--green-dark-05)]">
      {/* User-supplied URL (any host) — plain img avoids next/image domain allowlist. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={heading} className="absolute inset-0 h-full w-full object-cover" />
      {hasOverlay && (
        <div className="absolute inset-0 flex flex-col justify-center gap-3 p-8 sm:p-12" style={{ background: 'linear-gradient(90deg, rgba(28,37,48,.72), rgba(28,37,48,.15))' }}>
          {heading && <h2 className="max-w-[560px] text-[clamp(26px,3.6vw,40px)] font-bold leading-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>{heading}</h2>}
          {text && <p className="max-w-[460px] text-[15px] text-white/85">{text}</p>}
          {cta && <span className={`${btnClass('primary', 'lg')} mt-1 w-fit`}>{cta}</span>}
        </div>
      )}
    </div>
  );
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-8 sm:px-6">
      {href ? <Link href={href}>{body}</Link> : body}
    </section>
  );
}

export function ProductRowBlock({ props, locale, items }: { props: Props; locale: string; items: Product[] }) {
  if (!items || items.length === 0) return null;
  const t = pick(locale);
  const title = loc(props, 'title', locale);
  const action = s(props.actionHref);
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-[clamp(24px,3vw,30px)] font-bold text-green-dark">{title || t('Featured', 'مميّز')}</h2>
        {action && (
          <Link href={action} className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-dark hover:text-lime-press">
            {t('View all', 'عرض الكل')} <Icon name="arrow-right" size={16} color="var(--green-dark)" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[18px]">
        {items.map((p) => <ChewyProductCard key={p.slug} product={p} locale={locale} />)}
      </div>
    </section>
  );
}

export function CtaBlock({ props, locale }: { props: Props; locale: string }) {
  const heading = loc(props, 'heading', locale);
  const text = loc(props, 'text', locale);
  const cta = loc(props, 'ctaLabel', locale);
  const href = s(props.href);
  if (!heading && !cta) return null;
  const bg = s(props.bg) || 'green';
  const dark = bg !== 'light';
  const style = bg === 'dark'
    ? { background: 'var(--panel-dark)' }
    : bg === 'light'
      ? { background: 'var(--green-wash)' }
      : { background: 'linear-gradient(150deg, var(--green-emerald), #1c4a30)' };
  return (
    <section className="mt-10" style={style}>
      <div className="mx-auto max-w-[900px] px-4 py-14 text-center sm:px-6 sm:py-16">
        {heading && <h2 className={`text-[clamp(28px,4vw,44px)] font-bold leading-tight ${dark ? 'text-white' : 'text-green-dark'}`} style={{ fontFamily: 'var(--font-display)' }}>{heading}</h2>}
        {text && <p className={`mx-auto mt-3.5 max-w-[560px] text-[16px] leading-relaxed ${dark ? 'text-white/75' : 'text-[color:var(--text-muted)]'}`}>{text}</p>}
        {cta && href && <div className="mt-7"><Link href={href} className={btnClass(dark ? 'primary' : 'dark', 'lg')}>{cta}</Link></div>}
      </div>
    </section>
  );
}

type Tile = { labelEn?: string; labelAr?: string; href?: string; imageUrl?: string };
export function TilesBlock({ props, locale }: { props: Props; locale: string }) {
  const tiles = (Array.isArray(props.tiles) ? props.tiles : []) as Tile[];
  if (tiles.length === 0) return null;
  const title = loc(props, 'title', locale);
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-10 sm:px-6">
      {title && <h2 className="mb-5 text-[clamp(24px,3vw,30px)] font-bold text-ink">{title}</h2>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((tile, i) => {
          const label = (locale === 'ar' ? tile.labelAr : tile.labelEn) || tile.labelEn || '';
          return (
            <Link key={i} href={tile.href || '/products'} className="flex flex-col items-center gap-3 rounded-[18px] border border-[color:var(--green-dark-05)] bg-white px-3 py-5 text-center transition-all hover:border-green-dark hover:shadow-[var(--shadow-sm)]">
              {tile.imageUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={tile.imageUrl} alt="" className="size-24 object-contain" />
                : <span className="flex size-24 items-center justify-center rounded-full bg-green-wash"><Icon name="tag" size={34} color="var(--green-dark)" /></span>}
              <span className="text-[13.5px] font-semibold text-slate">{label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
