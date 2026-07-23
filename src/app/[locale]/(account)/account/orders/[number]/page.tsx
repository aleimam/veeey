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
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={order.customerStatus ?? order.status} />
          {/* Invoice download — hidden until the order is actually placed (paid/moved
              past AWAITING_PAYMENT). Ownership-checked server-side. */}
          {order.status !== 'AWAITING_PAYMENT' && (
            <a
              href={`/api/account/orders/${encodeURIComponent(order.number)}/invoice?lang=${locale}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[color:var(--green-dark-05)] px-3 py-1 text-xs font-medium text-green-dark hover:bg-[color:var(--green-wash)]"
            >
              {tb('Download invoice (PDF)', 'تحميل الفاتورة (PDF)')}
            </a>
          )}
        </div>
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
          {order.items.map((it) => {
            const name = (locale === 'ar' ? it.product.nameAr : it.product.nameEn) ?? it.product.nameEn;
            // FR-INV-02: the exact expiry the customer bought travels all the way to
            // their order history — shown on a smaller second line with the variation.
            const details = [
              it.lineExpiry ? `${tb('Expires', 'الصلاحية')} ${it.lineExpiry.toISOString().slice(0, 7)}` : null,
              isConditionVariant(it.condition) ? conditionLabel(it.condition, locale) : null,
              it.preorder ? tb('Pre-order', 'طلب مسبق') : null,
            ].filter(Boolean).join(' · ');
            const slug = (locale === 'ar' ? it.product.slugAr : it.product.slugEn) ?? it.product.slugEn;
            return (
              <li key={it.id} className="flex justify-between gap-4 py-2 text-sm text-ink">
                <span>
                  <Link href={`/products/${slug}`} className="font-medium text-green-dark hover:text-lime-press hover:underline">{name}</Link>
                  <span className="text-[color:var(--text-muted)]"> × {it.qty}</span>
                  {details && <span className="mt-0.5 block text-xs text-[color:var(--text-muted)]">{details}</span>}
                </span>
                <span className="whitespace-nowrap font-semibold">{formatEGP(Number(it.unitPricePiastres) * it.qty)}</span>
              </li>
            );
          })}
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
