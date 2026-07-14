import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'ar'
    ? { title: 'العلامات التجارية — Veeey', description: 'علامات مستوردة موثوقة، بمصادر أصلية من أمريكا وبريطانيا وأوروبا.' }
    : { title: 'Brands — Veeey', description: 'Trusted imported brands, sourced authentically from the USA, UK and EU.' };
}

/** Brand directory (audit P2 6.4): every active brand with its logo, story
 *  teaser and live product count, linking to its own page. */
export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  const brands = await prisma.brand.findMany({
    where: { archivedAt: null },
    orderBy: { nameEn: 'asc' },
    select: {
      id: true, slug: true, nameEn: true, nameAr: true, logoUrl: true, descriptionEn: true, descriptionAr: true,
      _count: { select: { products: { where: { status: 'PUBLISHED' } } } },
    },
  });
  const visible = brands.filter((b) => b._count.products > 0);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-3.5 flex items-center gap-2 text-[13px] text-[color:var(--text-muted)]">
        <Link href="/">{tb('Home', 'الرئيسية')}</Link>
        <Icon name={ar ? 'chevron-left' : 'chevron-right'} size={14} color="var(--slate-45)" />
        <span className="font-semibold text-slate">{tb('Brands', 'العلامات التجارية')}</span>
      </div>
      <h1 className="text-[clamp(28px,3.4vw,38px)] font-bold text-green-dark">{tb('Our brands', 'علاماتنا التجارية')}</h1>
      <p className="mt-1 max-w-2xl text-sm text-[color:var(--text-muted)]">
        {tb(
          'Trusted imported brands, sourced authentically from the USA, UK and EU — every lot dated.',
          'علامات مستوردة موثوقة بمصادر أصلية من أمريكا وبريطانيا وأوروبا — كل تشغيلة مؤرّخة.',
        )}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((b) => {
          const name = (ar ? b.nameAr : b.nameEn) ?? b.nameEn;
          return (
            <Link
              key={b.id}
              href={`/brands/${b.slug}`}
              className="group flex h-full flex-col items-center rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-5 text-center transition-all hover:-translate-y-[3px] hover:border-green-dark hover:shadow-[var(--shadow-card-hover)]"
            >
              <span className="flex h-20 items-center justify-center">
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt={name} className="max-h-20 max-w-[140px] object-contain" />
                ) : (
                  <span className="text-xl font-semibold text-slate" style={{ fontFamily: 'var(--font-display)' }}>{name}</span>
                )}
              </span>
              <span className="mt-3 text-[14.5px] font-bold text-ink group-hover:text-green-dark">{name}</span>
              <span className="mt-1 text-xs text-[color:var(--text-subtle)]">
                {tb(`${b._count.products} products`, `${b._count.products} منتجًا`)}
              </span>
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p className="col-span-full text-[color:var(--text-muted)]">{tb('Brands are coming soon.', 'العلامات قادمة قريبًا.')}</p>
        )}
      </div>
    </div>
  );
}
