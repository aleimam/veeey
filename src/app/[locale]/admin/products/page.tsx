import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listProducts } from '@/lib/catalog-service';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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
                <td className="p-3 text-end">
                  <Link href={`/admin/products/edit/${p.id}`} className="text-primary hover:underline">Edit</Link>
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
