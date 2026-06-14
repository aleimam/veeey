import { setRequestLocale } from 'next-intl/server';
import { listBrands } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function BrandsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const brands = await listBrands();
  return (
    <AdminList
      title="Brands"
      newHref="/admin/brands/edit"
      newLabel="New brand"
      head={['Name', 'Arabic', 'Slug']}
      rows={brands.map((b) => ({
        key: b.id,
        cells: [b.nameEn, b.nameAr ?? '—', b.slug],
        editHref: `/admin/brands/edit/${b.id}`,
      }))}
    />
  );
}
