import { setRequestLocale } from 'next-intl/server';
import { listGifts } from '@/lib/gift-service';
import { AdminList } from '@/components/admin/resource-list';

export default async function GiftsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gifts = await listGifts();
  return (
    <AdminList
      title="Gifts (hidden inventory)"
      newHref="/admin/gifts/edit"
      newLabel="New gift"
      head={['Code', 'Internal name', 'Stock', 'Expiry']}
      rows={gifts.map((g) => ({
        key: g.id,
        cells: [g.code, g.internalName, String(g.stock), g.expiry ? g.expiry.toISOString().slice(0, 10) : '—'],
        editHref: `/admin/gifts/edit/${g.id}`,
      }))}
    />
  );
}
