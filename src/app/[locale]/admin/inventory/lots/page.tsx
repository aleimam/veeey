import { setRequestLocale } from 'next-intl/server';
import { listLots } from '@/lib/inventory-service';
import { availableQty } from '@/lib/inventory';
import { formatEGP } from '@/lib/format';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

export default async function LotsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lots = await listLots();

  return (
    <AdminList
      title="Lots"
      newHref="/admin/inventory/lots/edit"
      newLabel="New lot"
      head={['Product', 'Location', 'Expiry', 'On hand', 'Avail', 'Price', 'Status']}
      rows={lots.map((l) => ({
        key: l.id,
        cells: [
          `${l.product.nameEn}`,
          l.location.name,
          l.expiryDate ? monthYear(l.expiryDate) : 'No expiry',
          String(l.qtyOnHand),
          String(availableQty(l)),
          formatEGP(Number(l.priceOverridePiastres ?? l.product.basePricePiastres)) + (l.saleFlag ? ' · sale' : ''),
          <StatusBadge key="s" status={l.status} />,
        ],
        editHref: `/admin/inventory/lots/edit/${l.id}`,
      }))}
    />
  );
}
