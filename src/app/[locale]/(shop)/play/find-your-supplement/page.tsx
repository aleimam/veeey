import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { GUIDED_QUIZ } from '@/lib/guided-selling';
import { findSupplementAction } from '@/server/play-actions';
import { cardProductInclude, toCardProduct } from '@/lib/storefront';
import { ProductRow } from '@/components/storefront/product-row';

type SP = Record<string, string | string[] | undefined>;

export default async function FindSupplementPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const g = (Array.isArray(sp.g) ? sp.g[0] : sp.g) ?? '';
  const goals = g.split(',').map((s) => s.trim()).filter(Boolean);

  let recs: ReturnType<typeof toCardProduct>[] = [];
  if (goals.length) {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED', OR: [{ categories: { some: { slug: { in: goals } } } }, { tags: { some: { slug: { in: goals } } } }] },
      include: cardProductInclude,
      orderBy: { ratingCount: 'desc' },
      take: 6,
    });
    recs = products.map((p) => toCardProduct(p, locale));
  }

  const t = await getTranslations('storefront.findSupplement');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t('title')}</h1>

      {goals.length === 0 ? (
        <form action={findSupplementAction} className="mt-6 space-y-6">
          <input type="hidden" name="locale" value={locale} />
          {GUIDED_QUIZ.map((q) => (
            <fieldset key={q.id} className="rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold">{q.q}</legend>
              <div className="mt-2 space-y-2">
                {q.options.map((o, i) => (
                  <label key={o.label} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={q.id} value={o.label} defaultChecked={i === 0} /> {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">{t('seeRecs')}</button>
        </form>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">{t('basedOn')}</p>
          {recs.length > 0 ? (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8"><ProductRow title="" products={recs} locale={locale} /></div>
          ) : (
            <p className="mt-3 text-sm">{t('noMatchPrefix')}<Link href="/products" className="text-primary hover:underline">{t('browseAll')}</Link>.</p>
          )}
          <Link href="/play/find-your-supplement" className="mt-4 inline-block text-sm text-primary hover:underline">{t('retake')}</Link>
        </div>
      )}
    </div>
  );
}
