import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link, redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { getOrderByNumber } from '@/lib/checkout-service';
import { customerLabel } from '@/lib/payment-method-service';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { formatEGP, shortDate } from '@/lib/format';
import { pick } from '@/lib/admin-i18n';
import { StatusBadge } from '@/components/admin/ui';
import { StatusTimeline } from '@/components/orders/status-timeline';

export const dynamic = 'force-dynamic';

type AddressSnapshot = {
  fullName?: string; phone?: string; governorate?: string; city?: string;
  area?: string; street?: string; building?: string; notes?: string;
};

export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale, number } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;

  const order = await getOrderByNumber(decodeURIComponent(number));
  // Ownership, not just "logged in": order numbers are semi-predictable, so a
  // signed-in customer must not be able to read someone else's order by
  // editing the URL. 404 rather than 403 — don't confirm the number exists.
  if (!order || !user.customerId || order.customerId !== user.customerId) notFound();

  const addr = (order.shippingAddressJson ?? null) as AddressSnapshot | null;
  const addrLine = addr
    ? [addr.building, addr.street, addr.area, addr.city, addr.governorate].filter(Boolean).join('، ')
    : null;

  const card = 'rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-6';
  const label = 'text-[color:var(--text-muted)]';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm">
        <Link href="/account#orders" className="text-green-dark hover:text-lime-press hover:underline">
          ← {tb('Back to my orders', 'العودة إلى طلباتي')}
        </Link>
      </p>

      <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>
            {order.number}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            {tb('Placed', 'تاريخ الطلب')} {shortDate(order.placedAt)}
          </p>
        </div>
        <StatusBadge status={order.customerStatus ?? order.status} />
      </header>

      {order.status === 'AWAITING_PAYMENT' && (
        <div className="mt-5 rounded-[12px] bg-[color:var(--gold-wash)] px-4 py-3 text-sm text-slate">
          {tb('This order is waiting for payment.', 'هذا الطلب في انتظار الدفع.')}{' '}
          <Link href={`/checkout/confirmation?order=${encodeURIComponent(order.number)}`} className="font-semibold text-green-dark underline">
            {tb('Pay now', 'ادفع الآن')}
          </Link>
        </div>
      )}

      <section className={`mt-6 ${card}`}>
        <h2 className="mb-3 text-sm font-bold text-ink">{tb('Items', 'المنتجات')}</h2>
        <ul className="divide-y divide-[color:var(--slate-border)]">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between gap-4 py-2 text-sm text-ink">
              <span>
                {(locale === 'ar' ? it.product.nameAr : it.product.nameEn) ?? it.product.nameEn} × {it.qty}
                {/* FR-INV-02: the exact expiry the customer bought travels all
                    the way to their order history, not just the invoice. */}
                {it.lineExpiry ? ` · ${tb('Expires', 'الصلاحية')} ${it.lineExpiry.toISOString().slice(0, 7)}` : ''}
                {isConditionVariant(it.condition) ? ` · ${conditionLabel(it.condition, locale)}` : ''}
                {it.preorder ? ` · ${tb('Pre-order', 'طلب مسبق')}` : ''}
              </span>
              <span className="whitespace-nowrap font-semibold">{formatEGP(Number(it.unitPricePiastres) * it.qty)}</span>
            </li>
          ))}
          {order.gifts.map((g) => (
            <li key={g.id} className="flex justify-between gap-4 py-2 text-sm text-green-dark">
              <span>🎁 {tb('Free gift', 'هدية مجانية')}: {(locale === 'ar' ? g.gift.nameAr : g.gift.nameEn) || g.gift.internalName}{g.qty > 1 ? ` × ${g.qty}` : ''}</span>
              <span className="font-semibold">{tb('FREE', 'مجانًا')}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-1 border-t border-[color:var(--slate-border)] pt-3 text-sm">
          <div className={`flex justify-between ${label}`}>
            <span>{tb('Delivery', 'الشحن')}</span>
            <span>{Number(order.shippingPiastres) === 0 ? tb('Free', 'مجاني') : formatEGP(Number(order.shippingPiastres))}</span>
          </div>
          <div className="flex justify-between font-bold text-green-dark">
            <span>{tb('Total', 'الإجمالي')}</span>
            <span>{formatEGP(Number(order.totalPiastres))}</span>
          </div>
          <div className={`flex justify-between ${label}`}>
            <span>{tb('Payment', 'الدفع')}</span>
            <span>{customerLabel(order.paymentMethod, locale)}</span>
          </div>
        </div>
      </section>

      {addrLine && (
        <section className={`mt-6 ${card}`}>
          <h2 className="mb-2 text-sm font-bold text-ink">{tb('Delivery address', 'عنوان التوصيل')}</h2>
          <p className="text-sm text-ink">{addr?.fullName}</p>
          <p className={`text-sm ${label}`}>{addrLine}</p>
          {addr?.phone && <p className={`text-sm ${label}`}>{addr.phone}</p>}
        </section>
      )}

      {order.statusHistory.length > 1 && (
        <div className="mt-6">
          <StatusTimeline
            entries={order.statusHistory.map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, note: null, createdAt: h.createdAt }))}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}
