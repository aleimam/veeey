import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listProducts } from '@/lib/catalog-service';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteEntityAction } from '@/server/admin-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const products = await listProducts();

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Products ({products.length})</h1>
        <Link href="/admin/products/edit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          New product
        </Link>
      </header>

      <InUseNotice show={one(sp.error) === 'in_use'} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">Name</th>
              <th className="p-3 text-start">SKU</th>
              <th className="p-3 text-start">Brand</th>
              <th className="p-3 text-start">Price</th>
              <th className="p-3 text-start">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 font-medium">{p.nameEn}</td>
                <td className="p-3 text-muted-foreground">{p.sku}</td>
                <td className="p-3 text-muted-foreground">{p.brand?.nameEn ?? '—'}</td>
                <td className="p-3">{formatEGP(Number(p.basePricePiastres))}</td>
                <td className="p-3"><StatusBadge status={p.status} /></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/admin/products/edit/${p.id}`} className="text-primary hover:underline">Edit</Link>
                    <form action={deleteEntityAction}>
                      <input type="hidden" name="entity" value="product" />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="path" value="products" />
                      <input type="hidden" name="locale" value={locale} />
                      <button className="text-destructive hover:underline">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No products yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
