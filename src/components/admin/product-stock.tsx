import { availableQty } from '@/lib/inventory';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from './ui';
import { Link } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { conditionLabel } from '@/lib/lot-condition';

type LotRow = {
  id: string;
  location: { name: string };
  expiryDate: Date | null;
  qtyOnHand: number;
  qtyReserved: number;
  priceOverridePiastres: bigint | null;
  condition: string;
  saleFlag: boolean;
  status: string;
};

const cell = 'p-2 align-top';

/**
 * Stock tab panel for the product edit page (owner-approved tabbed layout,
 * 2026-07-22): a READ-ONLY table of the product's lots (expiry × location) with
 * links to the dedicated inventory pages for editing. Inline lot editing moved
 * to those pages — the panel sits INSIDE the single product <form>, and the old
 * per-lot <form> elements can't nest there (invalid HTML).
 */
export function ProductStock({
  locale,
  sku,
  basePricePiastres,
  lots,
  canManage,
}: {
  locale: string;
  sku: string;
  basePricePiastres: bigint;
  lots: LotRow[];
  canManage: boolean;
}) {
  const tb = pick(locale);
  const live = lots.filter((l) => l.status === 'LIVE');
  const totalOnHand = live.reduce((s, l) => s + l.qtyOnHand, 0);
  const totalSellable = live.reduce((s, l) => s + availableQty(l), 0);
  const dateVal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  return (
    <section id="stock">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{tb('Stock & lots', 'المخزون والدفعات')}</h2>
        <p className="text-sm text-muted-foreground">
          {tb(
            `${totalSellable} sellable · ${totalOnHand} on hand (live lots)`,
            `${totalSellable} قابل للبيع · ${totalOnHand} متاح (دفعات حية)`,
          )}
        </p>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {tb(
          'Stock is tracked per lot = expiry × location. Sellable = on hand minus units reserved by open carts/orders. The base price is the product price (Details tab); a lot price overrides it for that expiry. This view is read-only — edit lots on the inventory pages linked here.',
          'يُتتبَّع المخزون لكل دفعة = الصلاحية × الموقع. القابل للبيع = المتاح ناقص المحجوز بسلال/طلبات مفتوحة. السعر الأساسي هو سعر المنتج (تبويب التفاصيل)؛ سعر الدفعة يتجاوزه لتلك الصلاحية. هذا العرض للقراءة فقط — عدّل الدفعات من صفحات المخزون المرتبطة هنا.',
        )}
      </p>
      {canManage && (
        <p className="mb-3 flex flex-wrap gap-4 text-sm">
          <Link href={`/admin/inventory/lots?q=${encodeURIComponent(sku)}`} className="text-primary hover:underline">{tb('Open in Lots ↗', 'فتح في الدفعات ↗')}</Link>
          <Link href="/admin/inventory/lots/edit" className="text-primary hover:underline">{tb('New lot ↗', 'دفعة جديدة ↗')}</Link>
          <Link href="/admin/inventory/intake" className="text-primary hover:underline">{tb('Stock intake ↗', 'إدخال المخزون ↗')}</Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className={`${cell} text-start`}>{tb('Location', 'الموقع')}</th>
              <th className={`${cell} text-start`}>{tb('Expiry', 'الصلاحية')}</th>
              <th className={`${cell} text-center`}>{tb('On hand', 'المتاح')}</th>
              <th className={`${cell} text-center`}>{tb('Reserved', 'المحجوز')}</th>
              <th className={`${cell} text-center`}>{tb('Sellable', 'القابل للبيع')}</th>
              <th className={`${cell} text-start`}>{tb('Lot price (EGP)', 'سعر الدفعة (ج.م)')}</th>
              <th className={`${cell} text-start`}>{tb('Condition', 'حالة العبوة')}</th>
              <th className={`${cell} text-start`}>{tb('Status', 'الحالة')}</th>
              {canManage && <th className={cell} />}
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className={cell}>{l.location.name}</td>
                <td className={cell}>{l.expiryDate ? dateVal(l.expiryDate) : tb('No expiry', 'بدون صلاحية')}</td>
                <td className={`${cell} text-center`}>{l.qtyOnHand}</td>
                <td className={`${cell} text-center`}>{l.qtyReserved}</td>
                <td className={`${cell} text-center`}>{availableQty(l)}</td>
                <td className={cell}>
                  {formatEGP(Number(l.priceOverridePiastres ?? basePricePiastres))}
                  {l.priceOverridePiastres != null ? ` · ${tb('override', 'تجاوز')}` : ''}
                  {l.saleFlag ? ` · ${tb('Sale', 'تخفيض')}` : ''}
                </td>
                <td className={cell}>{conditionLabel(l.condition, locale)}</td>
                <td className={cell}><StatusBadge status={l.status} /></td>
                {canManage && (
                  <td className={cell}>
                    <Link href={`/admin/inventory/lots/edit/${l.id}`} className="text-primary hover:underline">{tb('Edit', 'تعديل')}</Link>
                  </td>
                )}
              </tr>
            ))}
            {lots.length === 0 && (
              <tr>
                <td colSpan={canManage ? 9 : 8} className="p-4 text-center text-muted-foreground">
                  {canManage
                    ? tb('No stock yet — add a lot from "New lot" or "Stock intake" above.', 'لا يوجد مخزون بعد — أضف دفعة من «دفعة جديدة» أو «إدخال المخزون» بالأعلى.')
                    : tb('No stock yet.', 'لا يوجد مخزون بعد.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
