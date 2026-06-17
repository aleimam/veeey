import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listProducts } from '@/lib/catalog-service';
import { listBrands } from '@/lib/taxonomy-service';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteEntityAction } from '@/server/admin-actions';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { pick } from '@/lib/admin-i18n';

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
  const tb = pick(locale);

  const q = one(sp.q);
  const kind = one(sp.kind);
  const status = one(sp.status);
  const brand = one(sp.brand);

  const [products, brands] = await Promise.all([
    listProducts({ search: q, status, kind, brand }),
    listBrands(),
  ]);
  const brandOptions = brands.map((b) => ({ value: b.id, label: b.nameEn }));

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">{tb('Products', 'المنتجات')} ({products.length})</h1>
        <div className="flex items-center gap-2">
          <ExportBar entity="products" locale={locale} query={exportQs(sp)} />
          <Link href="/admin/products/edit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {tb('New product', 'منتج جديد')}
          </Link>
        </div>
      </header>

      <InUseNotice show={one(sp.error) === 'in_use'} />

      <FilterBar
        locale={locale}
        path="products"
        values={{ q, kind, status, brand }}
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Name / SKU', 'الاسم / رمز المنتج') },
          {
            name: 'kind',
            label: tb('Kind', 'النوع'),
            type: 'select',
            options: [
              { value: 'SUPPLEMENT', label: tb('Supplement', 'مكمل غذائي') },
              { value: 'DEVICE', label: tb('Device', 'جهاز') },
              { value: 'INJECTION', label: tb('Injection', 'حقن') },
            ],
          },
          {
            name: 'status',
            label: tb('Status', 'الحالة'),
            type: 'select',
            options: [
              { value: 'PUBLISHED', label: tb('Published', 'منشور') },
              { value: 'PRIVATE', label: tb('Private', 'خاص') },
              { value: 'DRAFT', label: tb('Draft', 'مسودة') },
              { value: 'ARCHIVED', label: tb('Archived', 'مؤرشف') },
            ],
          },
          { name: 'brand', label: tb('Brand', 'العلامة التجارية'), type: 'select', options: brandOptions },
        ]}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-start text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Name', 'الاسم')}</th>
              <th className="p-3 text-start">{tb('SKU', 'رمز المنتج (SKU)')}</th>
              <th className="p-3 text-start">{tb('Brand', 'العلامة التجارية')}</th>
              <th className="p-3 text-start">{tb('Price', 'السعر')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
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
                    <Link href={`/admin/products/edit/${p.id}`} className="text-primary hover:underline">{tb('Edit', 'تعديل')}</Link>
                    <form action={deleteEntityAction}>
                      <input type="hidden" name="entity" value="product" />
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="path" value="products" />
                      <input type="hidden" name="locale" value={locale} />
                      <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('No products yet.', 'لا توجد منتجات بعد.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
