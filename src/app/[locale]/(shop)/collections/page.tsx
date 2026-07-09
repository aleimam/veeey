import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listPublishedCollections } from '@/lib/content-service';
import { pick } from '@/lib/admin-i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === 'ar' ? 'المجموعات — Veeey' : 'Collections — Veeey';
  return {
    metadataBase: new URL('https://veeey.com'),
    title,
    alternates: { canonical: `/${locale}/collections`, languages: { en: '/en/collections', ar: '/ar/collections' } },
  };
}

export default async function CollectionsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';
  const collections = await listPublishedCollections();

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-[clamp(28px,3.4vw,38px)] font-bold text-green-dark">{tb('Collections', 'المجموعات')}</h1>
      {collections.length === 0 ? (
        <p className="text-[color:var(--text-muted)]">{tb('No collections yet — check back soon.', 'لا مجموعات بعد — تابعنا قريبًا.')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/collection/${c.slug}`}
              className="group overflow-hidden rounded-[16px] border border-[color:var(--green-dark-05)] bg-white transition-shadow hover:shadow-[var(--shadow-card)]"
            >
              <div className="aspect-[16/9] w-full overflow-hidden bg-green-wash">
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- CMS banner, arbitrary host
                  <img src={c.imageUrl} alt={(ar ? c.imageAltAr : c.imageAltEn) || (ar ? c.titleAr : c.titleEn) || c.titleEn} className="size-full object-cover transition-transform group-hover:scale-105" />
                )}
              </div>
              <div className="p-4">
                <h2 className="font-bold text-green-dark">{(ar ? c.titleAr : c.titleEn) || c.titleEn}</h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
