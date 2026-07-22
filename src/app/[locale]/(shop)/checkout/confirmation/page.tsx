import { setRequestLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { getOrderByNumber } from '@/lib/checkout-service';
import { getNumberSetting } from '@/lib/settings-service';
import { retryPaymentAction } from '@/server/cart-actions';
import { customerLabel, isOnlineMethod } from '@/lib/payment-method-service';
import { formatEGP } from '@/lib/format';
import { conditionLabel, isConditionVariant } from '@/lib/lot-condition';
import { TrackView } from '@/components/analytics/track-view';
import { StatusTimeline } from '@/components/orders/status-timeline';

type SP = Record<string, string | string[] | undefined>;

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SP>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('storefront.confirmation');
  const number = Array.isArray(sp.order) ? sp.order[0] : sp.order;
  const cancelled = (Array.isArray(sp.cancelled) ? sp.cancelled[0] : sp.cancelled) === '1';
  const payfail = (Array.isArray(sp.payfail) ? sp.payfail[0] : sp.payfail) === '1';
  let order = number ? await getOrderByNumber(number) : null;

  // Order numbers are semi-predictable, so gate the page: the browser that
  // placed the order (vy_orders cookie) or the logged-in owner may view it.
  if (order) {
    const mine = ((await cookies()).get('vy_orders')?.value ?? '').split(',');
    if (!mine.includes(order.number)) {
      const user = await getCurrentUser();
      if (!user?.customerId || user.customerId !== order.customerId) order = null;
    }
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-green-dark">{t('notFound')}</h1>
        <Link href="/products" className="mt-4 inline-block font-semibold text-green-dark hover:text-lime-press">{t('continueShopping')}</Link>
      </div>
    );
  }

  const isCard = isOnlineMethod(order.paymentMethod);
  // Checkout backlog P0: an online order is only "placed" once paid. While it
  // sits in AWAITING_PAYMENT this page is a payment screen, not a success
  // screen — headline, banner and a Pay-now retry that opens a FRESH gateway
  // session for the SAME order (the cart is already cleared). The sweep
  // auto-cancels + restocks it after the configured window.
  const awaiting = order.status === 'AWAITING_PAYMENT';
  const autoCancelMinutes = awaiting ? (await getNumberSetting('payments.awaitingAutoCancelMinutes')) || 35 : 0;
  const payBanner = isCard
    ? awaiting
      ? { tone: 'error' as const, msg: payfail ? t('paymentNotStarted') : cancelled ? t('paymentCancelled') : t('paymentAwaiting'), retry: true }
      : order.paymentState === 'PAID'
        ? { tone: 'ok' as const, msg: t('paymentPaid'), retry: false }
        : order.status === 'CANCELLED' // and not PAID (narrowed above)
          ? { tone: 'error' as const, msg: t('cancelledUnpaid'), retry: false }
          : order.paymentState === 'FAILED'
            ? { tone: 'error' as const, msg: t('paymentFailed'), retry: false }
            : { tone: 'pending' as const, msg: t('paymentPending'), retry: false }
    : null;
  const toneCls = { ok: 'bg-green-wash text-green-dark', pending: 'bg-gold-wash text-gold-deep', error: 'bg-error-wash text-error' };

  // GA4 `purchase` event (Analytics P4) — fire only for a completed order (COD is
  // placed; card must be PAID). GA4 dedupes repeat views by transaction_id.
  const purchaseComplete = !isCard || order.paymentState === 'PAID';
  const purchaseProps = purchaseComplete
    ? {
        orderId: order.number,
        value: Number(order.totalPiastres) / 100,
        currency: 'EGP',
        items: order.items.map((it) => ({ item_id: it.product.sku, item_name: it.product.nameEn, quantity: it.qty, price: Number(it.unitPricePiastres) / 100 })),
      }
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      {purchaseProps && <TrackView name="purchase" props={purchaseProps} />}
      <div className="rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-8 text-center shadow-[var(--shadow-card)]">
        {awaiting ? (
          <>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gold-wash text-2xl text-gold-deep">⏳</div>
            <h1 className="mt-4 text-3xl font-bold text-green-dark">{t('awaitingTitle')}</h1>
            <p className="mt-2 text-[color:var(--text-muted)]">{t('awaitingLead', { number: order.number })}</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-wash text-2xl text-green-dark">✓</div>
            <h1 className="mt-4 text-3xl font-bold text-green-dark">{t('thankYou')}</h1>
            <p className="mt-2 text-[color:var(--text-muted)]">{t('placed', { number: order.number })}</p>
          </>
        )}
      </div>

      {payBanner && (
        <div className={`mt-6 rounded-[12px] px-4 py-3 text-center text-sm ${toneCls[payBanner.tone]}`}>
          <p role={payBanner.tone === 'error' ? 'alert' : undefined}>{payBanner.msg}</p>
          {payBanner.retry && (
            <form action={retryPaymentAction} className="mt-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="number" value={order.number} />
              <button type="submit" className="v-btn v-btn--primary">{t('payNow')}</button>
              <p className="mt-2 text-xs text-[color:var(--text-muted)]">{t('autoCancelNote', { minutes: autoCancelMinutes })}</p>
            </form>
          )}
        </div>
      )}

      <div className="mt-6 rounded-[16px] border border-[color:var(--green-dark-05)] p-6">
        <h2 className="mb-3 text-sm font-bold text-ink">{t('summary')}</h2>
        <ul className="divide-y divide-[color:var(--slate-border)]">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between py-2 text-sm text-ink">
              <span>
                {(locale === 'ar' ? it.product.nameAr : it.product.nameEn) ?? it.product.nameEn} × {it.qty}
                {it.lineExpiry ? ` · ${t('exp', { date: it.lineExpiry.toISOString().slice(0, 7) })}` : ''}
                {isConditionVariant(it.condition) ? ` · ${conditionLabel(it.condition, locale)}` : ''}
                {it.preorder ? ` · ${locale === 'ar' ? 'طلب مسبق' : 'Pre-order'}` : ''}
              </span>
              <span className="font-semibold">{formatEGP(Number(it.unitPricePiastres) * it.qty)}</span>
            </li>
          ))}
          {order.gifts.map((g) => (
            <li key={g.id} className="flex justify-between text-green-dark">
              <span>🎁 {locale === 'ar' ? 'هدية مجانية' : 'Free gift'}: {(locale === 'ar' ? g.gift.nameAr : g.gift.nameEn) || g.gift.internalName}{g.qty > 1 ? ` × ${g.qty}` : ''}</span>
              <span className="font-semibold">{locale === 'ar' ? 'مجانًا' : 'FREE'}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-[color:var(--slate-border)] pt-3 text-sm">
          <div className="flex justify-between text-[color:var(--text-muted)]"><span>{t('shipping')}</span><span>{Number(order.shippingPiastres) === 0 ? t('free') : formatEGP(Number(order.shippingPiastres))}</span></div>
          <div className="flex justify-between font-bold text-green-dark"><span>{t('total')}</span><span>{formatEGP(Number(order.totalPiastres))}</span></div>
          {order.isPreorder && order.depositPaidPiastres != null && (
            <>
              <div className="flex justify-between text-gold-deep"><span>{locale === 'ar' ? 'العربون (مدفوع الآن)' : 'Deposit (paid now)'}</span><span className="font-semibold">{formatEGP(Number(order.depositPaidPiastres))}</span></div>
              <div className="flex justify-between text-[color:var(--text-muted)]"><span>{locale === 'ar' ? 'الباقي عند التوصيل' : 'Balance on delivery'}</span><span className="font-semibold">{formatEGP(Number(order.balanceDuePiastres ?? 0n))}</span></div>
            </>
          )}
          <div className="flex justify-between text-[color:var(--text-muted)]"><span>{t('payment')}</span><span>{customerLabel(order.paymentMethod, locale)}</span></div>
        </div>
        {order.isPreorder && (
          <p className="mt-3 rounded-[10px] bg-gold-wash px-3 py-2 text-xs leading-snug text-[color:var(--text-muted)]">
            {locale === 'ar'
              ? 'يتضمّن طلبك منتجًا بالطلب المسبق. سنجهّز طلبك ونشحنه كاملًا حين يتوفّر المخزون، ويُحصّل الباقي عند التوصيل.'
              : 'Your order includes a pre-order item. We’ll prepare and ship the whole order once it’s back in stock, and collect the balance on delivery.'}
          </p>
        )}
      </div>

      {order.statusHistory.length > 1 && (
        <div className="mt-6">
          <StatusTimeline entries={order.statusHistory.map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, note: null, createdAt: h.createdAt }))} locale={locale} />
        </div>
      )}

      <Link href="/products" className="mt-6 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('continueShopping')}</Link>
    </div>
  );
}
