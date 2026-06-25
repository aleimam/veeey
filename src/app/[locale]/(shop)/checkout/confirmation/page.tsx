import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getOrderByNumber } from '@/lib/checkout-service';
import { formatEGP } from '@/lib/format';

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
  const tPay = await getTranslations('storefront.payments');
  const number = Array.isArray(sp.order) ? sp.order[0] : sp.order;
  const cancelled = (Array.isArray(sp.cancelled) ? sp.cancelled[0] : sp.cancelled) === '1';
  const order = number ? await getOrderByNumber(number) : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-green-dark">{t('notFound')}</h1>
        <Link href="/products" className="mt-4 inline-block font-semibold text-green-dark hover:text-lime-press">{t('continueShopping')}</Link>
      </div>
    );
  }

  const isCard = order.paymentMethod === 'KASHIER' || order.paymentMethod === 'OPAY';
  // Online card flow: surface the gateway settlement state (webhook is the source
  // of truth). Cancelled return → prompt a retry from the cart.
  const payBanner = isCard
    ? cancelled || order.paymentState === 'FAILED'
      ? { tone: 'error' as const, msg: cancelled ? t('paymentCancelled') : t('paymentFailed'), retry: true }
      : order.paymentState === 'PAID'
        ? { tone: 'ok' as const, msg: t('paymentPaid'), retry: false }
        : { tone: 'pending' as const, msg: t('paymentPending'), retry: false }
    : null;
  const toneCls = { ok: 'bg-green-wash text-green-dark', pending: 'bg-gold-wash text-gold-deep', error: 'bg-error-wash text-error' };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-wash text-2xl text-green-dark">✓</div>
        <h1 className="mt-4 text-3xl font-bold text-green-dark">{t('thankYou')}</h1>
        <p className="mt-2 text-[color:var(--text-muted)]">{t('placed', { number: order.number })}</p>
      </div>

      {payBanner && (
        <div className={`mt-6 rounded-[12px] px-4 py-3 text-center text-sm ${toneCls[payBanner.tone]}`}>
          {payBanner.msg}
          {payBanner.retry && (
            <Link href="/cart" className="mt-1 block font-semibold underline">{t('retryPayment')}</Link>
          )}
        </div>
      )}

      <div className="mt-6 rounded-[16px] border border-[color:var(--green-dark-05)] p-6">
        <h2 className="mb-3 text-sm font-bold text-ink">{t('summary')}</h2>
        <ul className="divide-y divide-[color:var(--slate-border)]">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between py-2 text-sm text-ink">
              <span>{it.product.nameEn} × {it.qty}{it.lineExpiry ? ` · ${t('exp', { date: it.lineExpiry.toISOString().slice(0, 7) })}` : ''}</span>
              <span className="font-semibold">{formatEGP(Number(it.unitPricePiastres) * it.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-[color:var(--slate-border)] pt-3 text-sm">
          <div className="flex justify-between text-[color:var(--text-muted)]"><span>{t('shipping')}</span><span>{Number(order.shippingPiastres) === 0 ? t('free') : formatEGP(Number(order.shippingPiastres))}</span></div>
          <div className="flex justify-between font-bold text-green-dark"><span>{t('total')}</span><span>{formatEGP(Number(order.totalPiastres))}</span></div>
          <div className="flex justify-between text-[color:var(--text-muted)]"><span>{t('payment')}</span><span>{order.paymentMethod ? (tPay.has(order.paymentMethod) ? tPay(order.paymentMethod) : order.paymentMethod) : '—'}</span></div>
        </div>
      </div>

      <Link href="/products" className="mt-6 inline-block text-sm font-semibold text-green-dark hover:text-lime-press">{t('continueShopping')}</Link>
    </div>
  );
}
