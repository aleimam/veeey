import { saveProductLotAction } from '@/server/inventory-actions';
import { availableQty } from '@/lib/inventory';
import { piastresToEgp, formatEGP } from '@/lib/format';
import { StatusBadge, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';
import { LOT_CONDITIONS, conditionLabel } from '@/lib/lot-condition';

type LotRow = {
  id: string;
  locationId: string;
  location: { name: string };
  expiryDate: Date | null;
  qtyOnHand: number;
  qtyReserved: number;
  priceOverridePiastres: bigint | null;
  condition: string;
  saleFlag: boolean;
  status: string;
};

const LOT_STATUSES = ['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF'] as const;
const cell = 'p-2 align-top';
const mini = `${inputCls} h-9`;

/**
 * Stock & lots section for the product edit page. Lists every lot for the
 * product (location × expiry) with inline edit and an add-row. Writes go through
 * `saveProductLotAction` (records the movement-ledger delta) and return here.
 * When `canEdit` is false the table is read-only.
 */
export function ProductStock({
  locale,
  productId,
  basePricePiastres,
  lots,
  locations,
  canEdit,
}: {
  locale: string;
  productId: string;
  basePricePiastres: bigint;
  lots: LotRow[];
  locations: { value: string; label: string }[];
  canEdit: boolean;
}) {
  const tb = pick(locale);
  const live = lots.filter((l) => l.status === 'LIVE');
  const totalOnHand = live.reduce((s, l) => s + l.qtyOnHand, 0);
  const totalSellable = live.reduce((s, l) => s + availableQty(l), 0);
  const dateVal = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  return (
    <section id="stock" className="mt-10 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">{tb('Stock & lots', 'المخزون والدفعات')}</h2>
        <p className="text-sm text-muted-foreground">
          {tb(
            `${totalSellable} sellable · ${totalOnHand} on hand (live lots)`,
            `${totalSellable} قابل للبيع · ${totalOnHand} متاح (دفعات حية)`,
          )}
        </p>
      </div>
      <p className="mb-3 max-w-3xl text-xs text-muted-foreground">
        {tb(
          'Stock is tracked per lot = expiry × location. Sellable = on hand minus units reserved by open carts/orders. The base price is the product price above; a lot price overrides it for that expiry.',
          'يُتتبَّع المخزون لكل دفعة = الصلاحية × الموقع. القابل للبيع = المتاح ناقص المحجوز بسلال/طلبات مفتوحة. السعر الأساسي هو سعر المنتج بالأعلى؛ سعر الدفعة يتجاوزه لتلك الصلاحية.',
        )}
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className={`${cell} text-start`}>{tb('Location', 'الموقع')}</th>
              <th className={`${cell} text-start`}>{tb('Expiry', 'الصلاحية')}</th>
              <th className={`${cell} text-center`}>{tb('On hand', 'المتاح')}</th>
              <th className={`${cell} text-center`}>{tb('Sellable', 'القابل للبيع')}</th>
              <th className={`${cell} text-start`}>{tb('Lot price (EGP)', 'سعر الدفعة (ج.م)')}</th>
              <th className={`${cell} text-start`}>{tb('Condition', 'حالة العبوة')}</th>
              <th className={`${cell} text-start`}>{tb('Status', 'الحالة')}</th>
              {canEdit && <th className={cell} />}
            </tr>
          </thead>
          <tbody>
            {lots.map((l) =>
              canEdit ? (
                <tr key={l.id} className="border-t border-border">
                  <td className={cell}>
                    <select form={`lot-${l.id}`} name="locationId" defaultValue={l.locationId} className={`${mini} min-w-36`}>
                      {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <input form={`lot-${l.id}`} type="date" name="expiryDate" defaultValue={dateVal(l.expiryDate)} className={`${mini} w-40`} />
                    <label className="mt-1 flex items-center gap-1.5 text-xs">
                      <input form={`lot-${l.id}`} type="checkbox" name="noExpiry" defaultChecked={!l.expiryDate} className="size-3.5" />
                      {tb('No expiry (NA)', 'بدون صلاحية')}
                    </label>
                  </td>
                  <td className={`${cell} text-center`}>
                    <input form={`lot-${l.id}`} type="number" name="qtyOnHand" min="0" defaultValue={l.qtyOnHand} className={`${mini} w-20 text-center`} />
                  </td>
                  <td className={`${cell} text-center text-muted-foreground`}>{availableQty(l)}</td>
                  <td className={cell}>
                    <input
                      form={`lot-${l.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      name="priceOverrideEgp"
                      defaultValue={l.priceOverridePiastres != null ? piastresToEgp(l.priceOverridePiastres) : ''}
                      placeholder={String(piastresToEgp(basePricePiastres))}
                      className={`${mini} w-28`}
                    />
                    <label className="mt-1 flex items-center gap-1.5 text-xs">
                      <input form={`lot-${l.id}`} type="checkbox" name="saleFlag" defaultChecked={l.saleFlag} className="size-3.5" />
                      {tb('Near-expiry sale', 'تخفيض قرب الصلاحية')}
                    </label>
                  </td>
                  <td className={cell}>
                    <select form={`lot-${l.id}`} name="condition" defaultValue={l.condition} className={mini}>
                      {LOT_CONDITIONS.map((c) => <option key={c} value={c}>{conditionLabel(c, locale)}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <select form={`lot-${l.id}`} name="status" defaultValue={l.status} className={mini}>
                      {LOT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <form id={`lot-${l.id}`} action={saveProductLotAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="productId" value={productId} />
                      <input type="hidden" name="id" value={l.id} />
                      <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{tb('Save', 'حفظ')}</button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={l.id} className="border-t border-border">
                  <td className={cell}>{l.location.name}</td>
                  <td className={cell}>{l.expiryDate ? dateVal(l.expiryDate) : tb('No expiry', 'بدون صلاحية')}</td>
                  <td className={`${cell} text-center`}>{l.qtyOnHand}</td>
                  <td className={`${cell} text-center`}>{availableQty(l)}</td>
                  <td className={cell}>
                    {formatEGP(Number(l.priceOverridePiastres ?? basePricePiastres))}
                    {l.saleFlag ? ` · ${tb('Sale', 'تخفيض')}` : ''}
                  </td>
                  <td className={cell}>{conditionLabel(l.condition, locale)}</td>
                  <td className={cell}><StatusBadge status={l.status} /></td>
                </tr>
              ),
            )}
            {lots.length === 0 && (
              <tr><td colSpan={canEdit ? 8 : 7} className="p-4 text-center text-muted-foreground">{tb('No stock yet. Add a lot below.', 'لا يوجد مخزون بعد. أضف دفعة بالأسفل.')}</td></tr>
            )}
          </tbody>

          {canEdit && locations.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-surface/50">
                <td className={cell}>
                  <select form="lot-new" name="locationId" defaultValue={locations[0]?.value} className={`${mini} min-w-36`}>
                    {locations.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <input form="lot-new" type="date" name="expiryDate" className={`${mini} w-40`} />
                  <label className="mt-1 flex items-center gap-1.5 text-xs">
                    <input form="lot-new" type="checkbox" name="noExpiry" className="size-3.5" />
                    {tb('No expiry (NA)', 'بدون صلاحية')}
                  </label>
                </td>
                <td className={`${cell} text-center`}>
                  <input form="lot-new" type="number" name="qtyOnHand" min="0" defaultValue={0} className={`${mini} w-20 text-center`} />
                </td>
                <td className={`${cell} text-center text-muted-foreground`}>—</td>
                <td className={cell}>
                  <input form="lot-new" type="number" step="0.01" min="0" name="priceOverrideEgp" placeholder={String(piastresToEgp(basePricePiastres))} className={`${mini} w-28`} />
                  <label className="mt-1 flex items-center gap-1.5 text-xs">
                    <input form="lot-new" type="checkbox" name="saleFlag" className="size-3.5" />
                    {tb('Near-expiry sale', 'تخفيض قرب الصلاحية')}
                  </label>
                </td>
                <td className={cell}>
                  <select form="lot-new" name="condition" defaultValue="NEW" className={mini}>
                    {LOT_CONDITIONS.map((c) => <option key={c} value={c}>{conditionLabel(c, locale)}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <select form="lot-new" name="status" defaultValue="LIVE" className={mini}>
                    {LOT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <form id="lot-new" action={saveProductLotAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="productId" value={productId} />
                    <button className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">{tb('Add lot', 'إضافة دفعة')}</button>
                  </form>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {canEdit && locations.length === 0 && (
        <p className="mt-2 text-sm text-destructive">{tb('Create a storage location first (Inventory → Locations) to add stock.', 'أنشئ موقع تخزين أولًا (المخزون ← المواقع) لإضافة مخزون.')}</p>
      )}
    </section>
  );
}
