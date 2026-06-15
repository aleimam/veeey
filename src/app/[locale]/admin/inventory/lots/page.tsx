import { setRequestLocale } from 'next-intl/server';
import { listLots } from '@/lib/inventory-service';
import { availableQty } from '@/lib/inventory';
import { formatEGP } from '@/lib/format';
import { AdminList } from '@/components/admin/resource-list';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

export default async function LotsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const lots = await listLots();

  return (
    <AdminList
      title={tb('Lots', 'الدفعات')}
      newHref="/admin/inventory/lots/edit"
      newLabel={tb('New lot', 'دفعة جديدة')}
      head={[tb('Product', 'المنتج'), tb('Location', 'الموقع'), tb('Expiry', 'الصلاحية'), tb('On hand', 'المتاح'), tb('Sellable', 'القابل للبيع'), tb('Price', 'السعر'), tb('Status', 'الحالة')]}
      rows={lots.map((l) => ({
        key: l.id,
        cells: [
          `${l.product.nameEn}`,
          l.location.name,
          l.expiryDate ? monthYear(l.expiryDate) : tb('No expiry', 'بدون صلاحية'),
          String(l.qtyOnHand),
          String(availableQty(l)),
          formatEGP(Number(l.priceOverridePiastres ?? l.product.basePricePiastres)) + (l.saleFlag ? ` · ${tb('Sale', 'تخفيض')}` : ''),
          <StatusBadge key="s" status={l.status} />,
        ],
        editHref: `/admin/inventory/lots/edit/${l.id}`,
      }))}
    />
  );
}
