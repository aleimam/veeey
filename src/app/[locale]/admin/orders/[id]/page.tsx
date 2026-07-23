import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getOrder } from '@/lib/order-service';
import { StatusTimeline } from '@/components/orders/status-timeline';
import { prisma } from '@/lib/prisma';
import { listSystemMethods, customerLabel } from '@/lib/payment-method-service';
import { paidBalance } from '@/lib/order-money';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { CHANNELS } from '@/lib/channels';
import { pick } from '@/lib/admin-i18n';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { deriveSourceKey, sourceLabel, attributionDetail, type Attribution } from '@/lib/attribution';
import { shoppingStyleLabel, productsTypeLabel } from '@/lib/order-traits';
import { ChangeHistory } from '@/components/admin/change-history';
import { requestTypeLabel } from '@/lib/request-i18n';
import { requirePermission } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { Pencil } from 'lucide-react';

const monthYear = (d: Date | null) => (d ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}` : '—');

/** Read-only order DETAILS page (owner batch 2026-07-23). Every operational
 *  control moved to /admin/orders/[id]/edit — this is a clean overview with an
 *  "Edit order" button. Viewing needs orders.read; the Edit button shows to users
 *  who can actually act (orders.write or orders.fulfill). */
export default async function OrderDetailsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const user = await requirePermission('orders.read');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const order = await getOrder(id);
  if (!order) notFound();
  const systemMethods = await listSystemMethods();
  const canEdit = hasPermission(user.permissions, 'orders.write') || hasPermission(user.permissions, 'orders.fulfill');

  const paidDelta = order.paymentState === 'PAID' ? paidBalance(order.totalPiastres, order.paidAmountPiastres) : 0n;
  const shipped = !!(order.courier && order.trackingNumber);
  const sysMethodLabel = order.systemPaymentMethod ? (systemMethods.find((m) => m.code === order.systemPaymentMethod)) : null;
  const channel = order.source ? CHANNELS.find((c) => c.code === order.source) : null;

  // Timeline actor names (actorId → name), one query.
  const actorIds = [...new Set(order.statusHistory.map((h) => h.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const actorName = new Map(actors.map((a) => [a.id, a.name]));
  const timelineEntries = order.statusHistory.map((h) => ({
    fromStatus: h.fromStatus, toStatus: h.toStatus, note: h.note, createdAt: h.createdAt,
    actorName: h.actorId ? (actorName.get(h.actorId) ?? tb('Staff', 'موظف')) : tb('System', 'النظام'),
  }));

  return (
    <div className="p-6">
      <Link href="/admin/orders" className="text-sm text-primary hover:underline">← {tb('Orders', 'الطلبات')}</Link>
      <header className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{order.number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.customerId ? (
              <Link href={`/admin/customers/${order.customerId}`} className="font-medium text-primary hover:underline">{order.customer?.user.email || tb('Customer', 'العميل')}</Link>
            ) : (
              order.guestEmail ?? tb('Guest', 'زائر')
            )} · {order.placedAt.toISOString().slice(0, 10)} · {tb('Risk', 'المخاطرة')} {order.riskScore ?? 0} · <StatusBadge status={order.status} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/admin/orders/${order.id}/invoice?lang=${locale}`} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface">{tb('Print invoice (PDF)', 'طباعة الفاتورة (PDF)')}</a>
          {canEdit && (
            <Link href={`/admin/orders/${order.id}/edit`} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
              <Pencil size={15} /> {tb('Edit order', 'تعديل الطلب')}
            </Link>
          )}
        </div>
      </header>

      {order.paymentState === 'PAID' && paidDelta !== 0n && (
        <div className="mb-4 rounded-lg bg-gold/15 px-3 py-2 text-sm text-slate">
          {paidDelta > 0n
            ? tb(`This paid order's total is now ${formatEGP(Number(order.totalPiastres))}, but ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} was collected — balance owed ${formatEGP(Number(paidDelta))}.`,
                 `إجمالي هذا الطلب المدفوع أصبح ${formatEGP(Number(order.totalPiastres))}، لكن المُحصّل ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} — المتبقّي ${formatEGP(Number(paidDelta))}.`)
            : tb(`This paid order's total dropped to ${formatEGP(Number(order.totalPiastres))}; ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} was collected — overpaid ${formatEGP(Number(-paidDelta))} (refund may be due).`,
                 `انخفض إجمالي هذا الطلب المدفوع إلى ${formatEGP(Number(order.totalPiastres))}؛ المُحصّل ${formatEGP(Number(order.paidAmountPiastres ?? 0n))} — زيادة ${formatEGP(Number(-paidDelta))} (قد يلزم ردّها).`)}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items + totals (read-only) */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">{tb('Items', 'العناصر')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr><th className="p-2 text-start">{tb('Product', 'المنتج')}</th><th className="p-2">{tb('Expiry', 'الصلاحية')}</th><th className="p-2">{tb('Weight', 'الوزن')}</th><th className="p-2">{tb('Unit', 'الوحدة')}</th><th className="p-2">{tb('Qty', 'الكمية')}</th><th className="p-2">{tb('Total', 'الإجمالي')}</th></tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className={`border-t border-border ${it.lost ? 'opacity-60' : ''}`}>
                    <td className={`p-2 ${it.lost ? 'line-through' : ''}`}>{it.product.nameEn} <span className="text-muted-foreground">({it.product.sku})</span>{it.lost && <span className="ms-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive no-underline">{tb('Lost', 'مفقود')}</span>}</td>
                    <td className="p-2 text-center">
                      {it.preorder ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{tb('Pre-order', 'طلب مسبق')}</span> : monthYear(it.lineExpiry)}
                      {isConditionVariant(it.condition) && <span className="ms-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">{conditionLabel(it.condition, locale)}</span>}
                    </td>
                    <td className="p-2 text-center">{it.product.weightG != null ? `${it.product.weightG}g` : '—'}</td>
                    <td className="p-2 text-center">{formatEGP(Number(it.unitPricePiastres))}</td>
                    <td className="p-2 text-center">{it.qty}</td>
                    <td className={`p-2 text-center ${it.lost ? 'line-through' : ''}`}>{formatEGP(Number(it.unitPricePiastres) * it.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {order.gifts.length > 0 && (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>🎁 {tb('Internal gifts (hidden from customer)', 'هدايا داخلية (مخفية عن العميل)')}:</p>
              {order.gifts.map((g) => <div key={g.id} className="ps-5">{g.gift.code} · {g.gift.internalName} × {g.qty}</div>)}
            </div>
          )}
          <div className="mt-3 ms-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{tb('Subtotal', 'المجموع الفرعي')}</span><span>{formatEGP(Number(order.subtotalPiastres))}</span></div>
            {Number(order.discountPiastres) > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>{tb('Coupon discount', 'خصم الكوبون')}</span><span>− {formatEGP(Number(order.discountPiastres))}</span></div>
            )}
            {Number(order.manualDiscountPiastres) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{order.manualDiscountTitle || tb('Discount', 'خصم')}{order.manualDiscountPct ? ` (${order.manualDiscountPct}%)` : ''}</span>
                <span>− {formatEGP(Number(order.manualDiscountPiastres))}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>{tb('Shipping', 'الشحن')}{order.shippingFeeManual ? ` · ${tb('manual', 'يدوي')}` : ''}</span>
              <span>{Number(order.shippingPiastres) === 0 ? tb('Free', 'مجاني') : formatEGP(Number(order.shippingPiastres))}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground"><span>{tb('Total', 'الإجمالي')}</span><span>{formatEGP(Number(order.totalPiastres))}</span></div>
          </div>
          {order.isPreorder && (
            <div className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-end text-xs text-amber-900">
              {tb('Pre-order', 'طلب مسبق')} · {tb('Deposit', 'العربون')} {formatEGP(Number(order.depositPaidPiastres ?? 0n))} · {tb('Balance on delivery', 'الباقي عند التوصيل')} {formatEGP(Number(order.balanceDuePiastres ?? 0n))}
            </div>
          )}
        </section>

        {/* Info cards (read-only) */}
        <aside className="space-y-5 text-sm">
          <Card title={tb('Status', 'الحالة')}>
            <div className="mb-3"><StatusBadge status={order.status} /></div>
            <StatusTimeline entries={timelineEntries} locale={locale} showActor />
          </Card>

          <Card title={tb('Payment', 'الدفع')}>
            <Row label={tb('State', 'الحالة')}>{order.paymentState}</Row>
            <Row label={tb('Customer chose', 'اختار العميل')}>{customerLabel(order.paymentMethod, locale)}</Row>
            <Row label={tb('System method', 'طريقة النظام')}>{sysMethodLabel ? (locale === 'ar' ? sysMethodLabel.labelAr || sysMethodLabel.labelEn : sysMethodLabel.labelEn) : '—'}</Row>
            <Row label={tb('Payment check', 'مراجعة الدفع')}>{order.payCheck}</Row>
          </Card>

          <Card title={tb('Shipping', 'الشحن')}>
            {shipped ? (
              <>
                <Row label={tb('Courier', 'شركة الشحن')}>{order.courier === 'OWN' ? tb('Veeey Express', 'فيي إكسبريس') : order.courier}</Row>
                <Row label={order.courier === 'OWN' ? tb('Reference', 'المرجع') : tb('AWB', 'بوليصة الشحن')}>{order.trackingNumber}</Row>
                {order.courier === 'SMSA' && <a href={`/api/admin/carriers/smsa-label?awb=${encodeURIComponent(order.trackingNumber!)}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary hover:underline">{tb('Print label', 'طباعة الملصق')}</a>}
              </>
            ) : (
              <p className="text-muted-foreground">{tb('Not shipped yet.', 'لم يُشحن بعد.')} {order.shippingType ? `· ${order.shippingType}` : ''}</p>
            )}
          </Card>

          <Card title={tb('Pharmacist', 'الصيدلي')}>
            <p className="text-foreground">{order.pharmacist?.name ?? tb('Unassigned', 'غير معيَّن')}</p>
          </Card>

          {order.requests.length > 0 && (
            <Card title={tb('Purchasing requests', 'طلبات الشراء')}>
              <ul className="space-y-1.5">
                {order.requests.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <Link href={`/admin/requests/${r.id}`} className="font-mono text-primary hover:underline">{r.uid ?? r.id.slice(0, 8)}</Link>
                    <span className="text-muted-foreground">{requestTypeLabel(tb, r.type)}</span>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={tb('Shopping & source', 'الشراء والمصدر')}>
            <Row label={tb('Shopping Style', 'أسلوب الشراء')}>{shoppingStyleLabel(order.customerOrderType, locale) ?? '—'}</Row>
            <Row label={tb('Products type', 'نوع المنتجات')}>{productsTypeLabel(order.orderProductType, locale) ?? '—'}</Row>
            <Row label={tb('Order Source', 'مصدر الطلب')}>{channel ? (locale === 'ar' ? channel.ar : channel.en) : '—'}</Row>
            <Row label={tb('Traffic source', 'مصدر الزيارة')}>{sourceLabel(deriveSourceKey(order.utmJson as Attribution | null), locale)}</Row>
            {attributionDetail(order.utmJson as Attribution | null) && (
              <p className="truncate text-xs text-muted-foreground" title={attributionDetail(order.utmJson as Attribution | null)}>{attributionDetail(order.utmJson as Attribution | null)}</p>
            )}
          </Card>
        </aside>
      </div>

      <ChangeHistory entityType="Order" entityId={order.id} locale={locale} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-2 font-medium">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end font-medium text-foreground">{children}</span>
    </div>
  );
}
