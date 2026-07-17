import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listOrders, countOrders } from '@/lib/order-service';
import { prisma } from '@/lib/prisma';
import { salesStaff } from '@/lib/department-service';
import { ORDER_STATUSES } from '@/lib/order-status';
import { listStatusConfigs } from '@/lib/order-status-service';
import { CHANNELS, channelLabel } from '@/lib/channels';
import { customerLabel } from '@/lib/payment-method-service';
import { StatusBadge } from '@/components/admin/ui';
import { StaffAvatar, PaymentIcon, ChannelIcon } from '@/components/admin/order-cell-icons';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { OrderQuickActions } from '@/components/admin/order-quick-actions';
import { bulkOrdersAction } from '@/server/bulk-actions';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SORTABLE = ['number', 'customer', 'payment', 'status', 'items', 'total', 'placedAt'] as const;

/** `attention` + `booked` are pseudo-statuses (see orderWhere) — name them, don't echo the code. */
const statusFilterLabel = (status: string, tb: (en: string, ar: string) => string) =>
  status === 'attention' ? tb('Needs attention', 'تحتاج متابعة')
  : status === 'booked' ? tb('Bookings (excl. cancelled/refunded)', 'الحجوزات (عدا الملغاة/المستردة)')
  : status;

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('orders.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const status = one(sp.status);
  const payment = one(sp.payment);
  const payCheck = one(sp.payCheck);
  const from = one(sp.from);
  const to = one(sp.to);
  const minTotal = one(sp.minTotal);
  const maxTotal = one(sp.maxTotal);
  const productId = one(sp.productId);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: SORTABLE, defaultSort: 'placedAt' });
  const filters = { q, status, payment, payCheck, from, to, minTotal, maxTotal, productId };

  const [orders, total, statusCfgs, staff, filterProduct] = await Promise.all([
    listOrders({ ...filters, sort, dir, page, perPage }),
    countOrders(filters),
    listStatusConfigs(),
    salesStaff(), // pharmacist/handler picker = Sales department members (TEAM epic)
    // Name the product the chip is filtering by; a raw id tells the reader nothing.
    productId ? prisma.product.findUnique({ where: { id: productId }, select: { nameEn: true, nameAr: true } }) : null,
  ]);

  // Quick-edit props (serializable).
  const qaStatuses = statusCfgs.map((c) => ({ code: c.code, label: locale === 'ar' ? c.labelAr : c.labelEn, allowedNext: c.allowedNext }));
  const qaPharmacists = staff.map((s) => ({ value: s.id, label: s.name ?? s.email ?? '—' }));
  const qaChannels = CHANNELS.map((c) => ({ value: c.code, label: locale === 'ar' ? c.ar : c.en }));
  const qaLabels = {
    status: tb('Status', 'الحالة'), tracking: tb('Tracking', 'التتبع'), channel: tb('Channel', 'القناة'), pharmacist: tb('Pharmacist', 'الصيدلي'), invoice: tb('Invoice (PDF)', 'فاتورة (PDF)'),
    save: tb('Save', 'حفظ'), courier: tb('Courier', 'شركة الشحن'), trackingNo: tb('Tracking number', 'رقم التتبع'), deleteTracking: tb('Delete tracking', 'حذف التتبع'), unassigned: tb('— Unassigned —', '— غير معيَّن —'), final: tb('Final status.', 'حالة نهائية.'),
  };

  const basePath = `/${locale}/admin/orders`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, error: undefined })}`;
  const done = one(sp.done);

  // Active-filter chips — each removes just its own filter; a "Clear all" resets.
  const chips = ([
    q ? { name: 'q', label: `${tb('Search', 'بحث')}: ${q}` } : null,
    status ? { name: 'status', label: `${tb('Status', 'الحالة')}: ${statusFilterLabel(status, tb)}` } : null,
    payment ? { name: 'payment', label: `${tb('Payment', 'الدفع')}: ${customerLabel(payment, locale)}` } : null,
    payCheck ? { name: 'payCheck', label: `${tb('Check', 'مراجعة')}: ${payCheck}` } : null,
    from ? { name: 'from', label: `${tb('From', 'من')}: ${from}` } : null,
    to ? { name: 'to', label: `${tb('To', 'إلى')}: ${to}` } : null,
    // Bounds are shown with their exact comparison — maxTotal is exclusive, and
    // a chip reading "Total: 500" would hide that (V6 audit S13).
    minTotal ? { name: 'minTotal', label: `${tb('Total', 'الإجمالي')} ≥ ${minTotal}` } : null,
    maxTotal ? { name: 'maxTotal', label: `${tb('Total', 'الإجمالي')} < ${maxTotal}` } : null,
    productId ? { name: 'productId', label: `${tb('Product', 'المنتج')}: ${filterProduct ? (locale === 'ar' ? (filterProduct.nameAr ?? filterProduct.nameEn) : filterProduct.nameEn) : productId}` } : null,
  ].filter(Boolean) as { name: string; label: string }[]);

  const ops: BulkOp[] = [
    { value: 'status', label: tb('Set status', 'تعيين الحالة'), values: ORDER_STATUSES.map((s) => ({ value: s, label: s.replaceAll('_', ' ') })) },
    { value: 'payCheck', label: tb('Set payment check', 'مراجعة الدفع'), values: ['NO', 'YES', 'PROBLEM'].map((p) => ({ value: p, label: p })) },
    { value: 'delete', label: tb('Delete (Pending/Cancelled only)', 'حذف (قيد الانتظار/ملغى فقط)'), danger: true },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-xl font-semibold">
            {tb('Orders', 'الطلبات')} ({total})
            {chips.length > 0 && <span className="ms-1 text-sm font-normal text-muted-foreground">· {tb('filtered', 'مُصفّى')}</span>}
          </h1>
          <Link href="/admin/orders/new" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">{tb('New order', 'طلب جديد')}</Link>
          <ExportBar entity="orders" locale={locale} query={exportQs(sp)} />
        </div>
      </header>

      {done != null && (
        <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(`Updated ${done} order(s).`, `تم تحديث ${done} طلب.`)}{Number(one(sp.skip)) > 0 ? tb(` ${one(sp.skip)} skipped (invalid transition).`, ` تم تخطّي ${one(sp.skip)} (انتقال غير صالح).`) : ''}
        </p>
      )}
      {one(sp.error) === 'bulk' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Bulk action failed.', 'فشل الإجراء الجماعي.')}</p>}

      <FilterBar
        locale={locale}
        path="orders"
        values={{ q, status, payment, payCheck, from, to }}
        // Arrive here from a Sales drill-through and these have no field to
        // live in; carry them so filtering again doesn't silently widen the list.
        keep={{ minTotal, maxTotal, productId }}
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Order # or customer', 'رقم الطلب أو العميل') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: ORDER_STATUSES.map((s) => ({ value: s, label: s })) },
          { name: 'payment', label: tb('Payment', 'الدفع'), type: 'select', options: ['COD', 'POS_ON_DELIVERY', 'KASHIER', 'BANK_TRANSFER', 'WALLET'].map((p) => ({ value: p, label: p })) },
          { name: 'payCheck', label: tb('Payment check', 'مراجعة الدفع'), type: 'select', options: ['NO', 'YES', 'PROBLEM'].map((p) => ({ value: p, label: p })) },
          { name: 'from', label: tb('From', 'من'), type: 'date' },
          { name: 'to', label: tb('To', 'إلى'), type: 'date' },
        ]}
      />

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{tb('Filtered by', 'مُصفّى حسب')}:</span>
          {chips.map((c) => (
            <Link key={c.name} href={`/admin/orders${listQs(sp, { [c.name]: undefined, page: undefined })}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs hover:border-primary">
              {c.label} <span aria-hidden>×</span>
            </Link>
          ))}
          <Link href="/admin/orders" className="text-xs text-primary hover:underline">{tb('Clear all', 'مسح الكل')}</Link>
        </div>
      )}

      <BulkBar
        formId="bulk-orders"
        action={bulkOrdersAction}
        locale={locale}
        back={back}
        ops={ops}
        exportHref="/api/admin/export/orders"
        labels={{ selectAllPage: tb('Select page', 'تحديد الصفحة'), selected: tb('selected', 'محدد'), apply: tb('Apply', 'تطبيق'), exportSel: tb('Export selected', 'تصدير المحدد'), confirmDanger: tb('Apply to the selected orders? Delete permanently removes Pending/Cancelled orders.', 'تطبيق على الطلبات المحددة؟ الحذف يزيل نهائيًا طلبات قيد الانتظار/الملغاة.'), needValue: tb('Choose a value first.', 'اختر قيمة أولًا.') }}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-3" />
              <SortableTh col="placedAt" label={tb('Date', 'التاريخ')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="number" label={tb('Order', 'الطلب')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="customer" label={tb('Customer', 'العميل')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Handler', 'المسؤول')}</th>
              <th className="p-3 text-start">{tb('Channel', 'القناة')}</th>
              <SortableTh col="payment" label={tb('Pay', 'الدفع')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Check', 'مراجعة')}</th>
              <SortableTh col="status" label={tb('Status', 'الحالة')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="items" label={tb('Items', 'العناصر')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="total" label={tb('Total', 'الإجمالي')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={o.id} form="bulk-orders" className="size-4" aria-label={o.number} /></td>
                <td className="whitespace-nowrap p-3 text-muted-foreground" title={new Date(o.placedAt).toISOString()}>
                  {new Date(o.placedAt).toISOString().slice(0, 10)} <span className="text-xs">{new Date(o.placedAt).toISOString().slice(11, 16)}</span>
                </td>
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium text-primary hover:underline">{o.number}</Link></td>
                <td className="p-3">
                  {(() => {
                    const name = [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(' ') || o.customer?.user.name || o.customer?.user.email || o.guestEmail;
                    const q = o.customer?.user.email || o.guestEmail || name;
                    return name
                      ? <Link href={`/admin/orders?q=${encodeURIComponent(q ?? '')}`} className="hover:text-primary hover:underline">{name}</Link>
                      : <span className="text-muted-foreground">{tb('Guest', 'زائر')}</span>;
                  })()}
                </td>
                <td className="p-3"><StaffAvatar name={o.pharmacist?.name} image={o.pharmacist?.image} /></td>
                <td className="p-3"><ChannelIcon code={o.source} label={channelLabel(o.source, locale)} /></td>
                <td className="p-3"><PaymentIcon code={o.paymentMethod} label={customerLabel(o.paymentMethod, locale)} /></td>
                <td className="p-3"><span className={o.payCheck === 'PROBLEM' ? 'text-destructive' : o.payCheck === 'YES' ? 'text-primary' : 'text-muted-foreground'}>{o.payCheck}</span></td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
                <td className="p-3">
                  <Link href={`/admin/orders/${o.id}`} className="hover:text-primary hover:underline">{o._count.items}</Link>
                  {o._count.items === 0 && Number(o.totalPiastres) > 0 && (
                    <span title={tb('No items but a non-zero total — please review', 'لا عناصر مع إجمالي غير صفري — يُرجى المراجعة')} className="ms-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">!</span>
                  )}
                </td>
                <td className="p-3"><Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-primary hover:underline">{(Number(o.totalPiastres) / 100).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Link></td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <OrderQuickActions
                      locale={locale}
                      order={{ id: o.id, status: o.status, trackingNumber: o.trackingNumber, courier: o.courier, source: o.source, pharmacistId: o.pharmacistId }}
                      statuses={qaStatuses}
                      pharmacists={qaPharmacists}
                      channels={qaChannels}
                      invoiceHref={`/api/admin/orders/${o.id}/invoice`}
                      labels={qaLabels}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">
                {tb('No orders match your filters.', 'لا توجد طلبات مطابقة للتصفية.')}
                {chips.length > 0 && <> · <Link href="/admin/orders" className="text-primary hover:underline">{tb('Clear filters', 'مسح التصفية')}</Link></>}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
