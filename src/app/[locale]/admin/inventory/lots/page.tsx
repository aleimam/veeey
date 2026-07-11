import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listLots, countLots } from '@/lib/inventory-service';
import { listLocations } from '@/lib/location-service';
import { availableQty } from '@/lib/inventory';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { bulkLotsAction } from '@/server/bulk-actions';
import { parseListParams, listQs, one, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import { conditionLabel, isConditionVariant, LOT_CONDITIONS } from '@/lib/lot-condition';

const monthYear = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
const SORTABLE = ['product', 'location', 'expiry', 'onhand', 'price', 'status'] as const;
const LOT_STATUSES = ['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF'] as const;

export default async function LotsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const q = one(sp.q);
  const status = one(sp.status);
  const locationId = one(sp.location);
  const stock = one(sp.stock);
  const sale = one(sp.sale);
  const expiring = one(sp.expiring);
  const condition = one(sp.condition);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: SORTABLE, defaultSort: 'expiry', defaultDir: 'asc' });
  const filters = { search: q, status, locationId, stock, sale, expiring, condition };

  const [lots, total, locations] = await Promise.all([
    listLots({ ...filters, sort, dir, page, perPage }),
    countLots(filters),
    listLocations(),
  ]);

  const basePath = `/${locale}/admin/inventory/lots`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, error: undefined })}`;
  const done = one(sp.done);
  const bulkError = one(sp.error) === 'bulk';

  const ops: BulkOp[] = [
    {
      value: 'discount',
      label: tb('Near-expiry discount', 'تخفيض قرب الانتهاء'),
      values: ['10', '15', '20', '25', '30', '40', '50'].map((p) => ({ value: p, label: `−${p}%` })),
    },
    {
      value: 'status',
      label: tb('Set status', 'تغيير الحالة'),
      values: LOT_STATUSES.map((s) => ({ value: s, label: s })),
      danger: true, // status flips (e.g. WRITTEN_OFF) are destructive — confirm first
    },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Lots', 'الدفعات')} ({total})</h1>
        <span className="flex items-center gap-2">
          <ExportBar entity="lots" locale={locale} query={exportQs(sp)} />
          <Link href="/admin/inventory/lots/edit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New lot', 'دفعة جديدة')}</Link>
        </span>
      </header>

      {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} lot(s) updated.`, `تم — ${done} دفعة.`)}</p>}
      {bulkError && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Bulk action failed — check the selection and value.', 'فشل الإجراء الجماعي — راجع التحديد والقيمة.')}</p>}

      <FilterBar
        locale={locale}
        path="inventory/lots"
        values={{ q, status, location: locationId, stock, sale, expiring, condition }}
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Product name / SKU', 'اسم المنتج / SKU') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: LOT_STATUSES.map((s) => ({ value: s, label: s })) },
          { name: 'location', label: tb('Location', 'الموقع'), type: 'select', options: locations.map((l) => ({ value: l.id, label: l.name })) },
          { name: 'stock', label: tb('Stock', 'المخزون'), type: 'select', options: [
            { value: 'in', label: tb('In stock', 'متوفر') },
            { value: 'low', label: tb('Low stock (≤5)', 'مخزون منخفض (≤5)') },
            { value: 'zero', label: tb('Out of stock', 'غير متوفر') },
          ] },
          { name: 'sale', label: tb('Sale', 'التخفيض'), type: 'select', options: [{ value: '1', label: tb('On sale', 'عليه تخفيض') }] },
          { name: 'expiring', label: tb('Expiring within', 'تنتهي خلال'), type: 'select', options: [
            { value: '30', label: tb('30 days', '٣٠ يومًا') },
            { value: '90', label: tb('90 days', '٩٠ يومًا') },
            { value: '180', label: tb('180 days', '١٨٠ يومًا') },
          ] },
          { name: 'condition', label: tb('Condition', 'حالة العبوة'), type: 'select', options: LOT_CONDITIONS.map((c) => ({ value: c, label: conditionLabel(c, locale) })) },
        ]}
      />

      <BulkBar
        formId="bulk-lots"
        action={bulkLotsAction}
        locale={locale}
        back={back}
        ops={ops}
        exportHref="/api/admin/export/lots"
        labels={{ selectAllPage: tb('Select page', 'تحديد الصفحة'), selected: tb('selected', 'محدد'), apply: tb('Apply', 'تطبيق'), exportSel: tb('Export selected', 'تصدير المحدد'), confirmDanger: tb('Apply this status to the selected lots?', 'تطبيق هذه الحالة على الدفعات المحددة؟'), needValue: tb('Choose a value first.', 'اختر قيمة أولًا.') }}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-3" />
              <SortableTh col="product" label={tb('Product', 'المنتج')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="location" label={tb('Location', 'الموقع')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="expiry" label={tb('Expiry', 'الصلاحية')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="onhand" label={tb('On hand', 'المتاح')} sort={sort} dir={dir} sp={sp} basePath={basePath} align="center" />
              <th className="p-3 text-center">{tb('Reserved', 'محجوز')}</th>
              <th className="p-3 text-center">{tb('Sellable', 'القابل للبيع')}</th>
              <SortableTh col="price" label={tb('Price', 'السعر')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="status" label={tb('Status', 'الحالة')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {lots.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={l.id} form="bulk-lots" className="size-4" aria-label={l.product.sku} /></td>
                <td className="p-3"><div className="font-medium">{l.product.nameEn}</div><div className="font-mono text-xs text-muted-foreground">{l.product.sku}</div></td>
                <td className="p-3 text-muted-foreground">{l.location.name}</td>
                <td className="p-3">
                  {l.expiryDate ? monthYear(l.expiryDate) : tb('No expiry', 'بدون صلاحية')}
                  {isConditionVariant(l.condition) && <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{conditionLabel(l.condition, locale)}</span>}
                </td>
                <td className="p-3 text-center">{l.qtyOnHand}</td>
                <td className={`p-3 text-center ${l.qtyReserved > 0 ? 'font-medium text-gold' : 'text-muted-foreground'}`}>{l.qtyReserved}</td>
                <td className="p-3 text-center text-muted-foreground">{availableQty(l)}</td>
                <td className="p-3">{formatEGP(Number(l.priceOverridePiastres ?? l.product.basePricePiastres))}{l.saleFlag ? ` · ${tb('Sale', 'تخفيض')}` : ''}</td>
                <td className="p-3"><StatusBadge status={l.status} /></td>
                <td className="p-3 text-end"><Link href={`/admin/inventory/lots/edit/${l.id}`} className="text-primary hover:underline">{tb('Edit', 'تعديل')}</Link></td>
              </tr>
            ))}
            {lots.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{tb('No lots match.', 'لا توجد دفعات مطابقة.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
