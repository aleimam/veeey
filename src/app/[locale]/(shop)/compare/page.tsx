import Image from 'next/image';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireFeature } from '@/lib/feature-service';
import { Link } from '@/i18n/navigation';
import { readCompareId, getCompareProducts } from '@/lib/compare-service';
import { toggleCompareAction } from '@/server/engagement-actions';
import { formatEGP } from '@/lib/format';

const cell = 'border border-[color:var(--slate-border)] p-3';
const headCell = 'border border-[color:var(--slate-border)] bg-surface p-3 font-semibold text-ink';

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireFeature('compare', locale);
  const t = await getTranslations('storefront.compare');
  const compareId = await readCompareId();
  const products = compareId ? await getCompareProducts(compareId) : [];

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-green-dark">{t('emptyTitle')}</h1>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('emptyNote')}</p>
        <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('browse')}</Link>
      </div>
    );
  }

  // Union of attribute names across all compared products → aligned rows.
  const attrNames = Array.from(new Set(products.flatMap((p) => p.attributeValues.map((av) => av.attributeValue.attribute.nameEn))));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{t('title', { count: products.length })}</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-32 border border-[color:var(--slate-border)] p-3" />
              {products.map((p) => (
                <td key={p.id} className="border border-[color:var(--slate-border)] p-3 align-top">
                  <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-[10px] bg-surface">
                    <Image src={p.images[0]?.url ?? '/placeholder.svg'} alt={p.nameEn} fill sizes="200px" className="object-contain p-2" />
                  </div>
                  <Link href={`/products/${p.slugEn}`} className="font-semibold text-ink hover:text-green-dark">{p.nameEn}</Link>
                  <form action={toggleCompareAction} className="mt-1">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={p.id} />
                    <input type="hidden" name="back" value="/compare" />
                    <button className="text-xs text-slate-45 hover:text-error">{t('remove')}</button>
                  </form>
                </td>
              ))}
            </tr>
            <tr>
              <td className={headCell}>{t('brand')}</td>
              {products.map((p) => <td key={p.id} className={cell}>{p.brand?.nameEn ?? '—'}</td>)}
            </tr>
            <tr>
              <td className={headCell}>{t('price')}</td>
              {products.map((p) => <td key={p.id} className={cell}>{formatEGP(Number(p.basePricePiastres))}</td>)}
            </tr>
            <tr>
              <td className={headCell}>{t('rating')}</td>
              {products.map((p) => <td key={p.id} className={cell}>{(p.ratingAvg ?? 0).toFixed(1)} ({p.ratingCount})</td>)}
            </tr>
            <tr>
              <td className={headCell}>{t('inStock')}</td>
              {products.map((p) => <td key={p.id} className={cell}>{p.lots.some((l) => l.qtyOnHand > 0) ? t('yes') : t('preorder')}</td>)}
            </tr>
            {attrNames.map((name) => (
              <tr key={name}>
                <td className={headCell}>{name}</td>
                {products.map((p) => (
                  <td key={p.id} className={cell}>
                    {p.attributeValues.filter((av) => av.attributeValue.attribute.nameEn === name).map((av) => av.attributeValue.valueEn).join(', ') || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
