import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { readCompareId, getCompareProducts } from '@/lib/compare-service';
import { toggleCompareAction } from '@/server/engagement-actions';
import { formatEGP } from '@/lib/format';

export default async function ComparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const compareId = await readCompareId();
  const products = compareId ? await getCompareProducts(compareId) : [];

  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Nothing to compare yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Add up to 4 products from any product page.</p>
        <Link href="/products" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Browse products</Link>
      </div>
    );
  }

  // Union of attribute names across all compared products → aligned rows.
  const attrNames = Array.from(new Set(products.flatMap((p) => p.attributeValues.map((av) => av.attributeValue.attribute.nameEn))));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">Compare ({products.length}/4)</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-32 border border-border p-3" />
              {products.map((p) => (
                <td key={p.id} className="border border-border p-3 align-top">
                  <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-surface">
                    <Image src={p.images[0]?.url ?? '/placeholder.svg'} alt={p.nameEn} fill sizes="200px" className="object-cover" />
                  </div>
                  <Link href={`/products/${p.slugEn}`} className="font-medium text-foreground hover:text-primary">{p.nameEn}</Link>
                  <form action={toggleCompareAction} className="mt-1">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={p.id} />
                    <input type="hidden" name="back" value="/compare" />
                    <button className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
                  </form>
                </td>
              ))}
            </tr>
            <tr>
              <td className="border border-border bg-surface p-3 font-medium">Brand</td>
              {products.map((p) => <td key={p.id} className="border border-border p-3">{p.brand?.nameEn ?? '—'}</td>)}
            </tr>
            <tr>
              <td className="border border-border bg-surface p-3 font-medium">Price</td>
              {products.map((p) => <td key={p.id} className="border border-border p-3">{formatEGP(Number(p.basePricePiastres))}</td>)}
            </tr>
            <tr>
              <td className="border border-border bg-surface p-3 font-medium">Rating</td>
              {products.map((p) => <td key={p.id} className="border border-border p-3">{(p.ratingAvg ?? 0).toFixed(1)} ({p.ratingCount})</td>)}
            </tr>
            <tr>
              <td className="border border-border bg-surface p-3 font-medium">In stock</td>
              {products.map((p) => <td key={p.id} className="border border-border p-3">{p.lots.some((l) => l.qtyOnHand > 0) ? 'Yes' : 'Pre-order'}</td>)}
            </tr>
            {attrNames.map((name) => (
              <tr key={name}>
                <td className="border border-border bg-surface p-3 font-medium">{name}</td>
                {products.map((p) => (
                  <td key={p.id} className="border border-border p-3">
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
