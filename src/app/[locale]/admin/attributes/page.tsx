import { setRequestLocale } from 'next-intl/server';
import { listAttributes } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function AttributesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const attributes = await listAttributes();
  return (
    <AdminList
      title="Attributes"
      newHref="/admin/attributes/edit"
      newLabel="New attribute"
      head={['Name', 'Key', 'Values']}
      rows={attributes.map((a) => ({
        key: a.id,
        cells: [a.nameEn, a.key, String(a.values.length)],
        editHref: `/admin/attributes/edit/${a.id}`,
      }))}
    />
  );
}
