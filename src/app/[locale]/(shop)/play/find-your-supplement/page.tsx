import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireFeature } from '@/lib/feature-service';
import { prisma } from '@/lib/prisma';
import { GUIDED_QUIZ } from '@/lib/guided-selling';
import { findSupplementAction } from '@/server/play-actions';
import { cardProductInclude, toCardProduct, visibleProductWhere } from '@/lib/storefront';
import { ProductRow } from '@/components/storefront/product-row';

type SP = Record<string, string | string[] | undefined>;

export default async function FindSupplementPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireFeature('quizzes', locale);
  const g = (Array.isArray(sp.g) ? sp.g[0] : sp.g) ?? '';
  const goals = g.split(',').map((s) => s.trim()).filter(Boolean);

  let recs: ReturnType<typeof toCardProduct>[] = [];
  if (goals.length) {
    const products = await prisma.product.findMany({
      where: { status: 'PUBLISHED', AND: [visibleProductWhere], OR: [{ categories: { some: { slug: { in: goals } } } }, { tags: { some: { slug: { in: goals } } } }] },
      include: cardProductInclude,
      orderBy: { ratingCount: 'desc' },
      take: 6,
    });
    recs = products.map((p) => toCardProduct(p, locale));
  }

  const t = await getTranslations('storefront.findSupplement');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-green-dark">{t('title')}</h1>

      {goals.length === 0 ? (
        <form action={findSupplementAction} className="mt-6 space-y-6">
          <input type="hidden" name="locale" value={locale} />
          {GUIDED_QUIZ.map((q) => (
            <fieldset key={q.id} className="rounded-[12px] border border-[color:var(--slate-border)] p-4">
              <legend className="px-1 text-sm font-semibold text-ink">{q.q}</legend>
              <div className="mt-2 space-y-2">
                {q.options.map((o, i) => (
                  <label key={o.label} className="flex items-center gap-2 text-sm text-ink">
                    <input type="radio" name={q.id} value={o.label} defaultChecked={i === 0} className="accent-[color:var(--green-dark)]" /> {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <button className="v-btn v-btn--primary">{t('seeRecs')}</button>
        </form>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-[color:var(--text-muted)]">{t('basedOn')}</p>
          {recs.length > 0 ? (
            <div className="-mx-4 sm:-mx-6 lg:-mx-8"><ProductRow title="" products={recs} locale={locale} /></div>
          ) : (
            <p className="mt-3 text-sm text-ink">{t('noMatchPrefix')}<Link href="/products" className="font-semibold text-green-dark hover:text-lime-press">{t('browseAll')}</Link>.</p>
          )}
          <Link href="/play/find-your-supplement" className="mt-4 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('retake')}</Link>
        </div>
      )}
    </div>
  );
}
