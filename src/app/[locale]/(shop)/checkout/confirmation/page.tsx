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
  const order = number ? await getOrderByNumber(number) : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-semibold">{t('notFound')}</h1>
        <Link href="/products" className="mt-4 inline-block text-primary hover:underline">{t('continueShopping')}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">✓</div>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">{t('thankYou')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('placed', { number: order.number })}
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-border p-6">
        <h2 className="mb-3 text-sm font-semibold">{t('summary')}</h2>
        <ul className="divide-y divide-border">
          {order.items.map((it) => (
            <li key={it.id} className="flex justify-between py-2 text-sm">
              <span>{it.product.nameEn} × {it.qty}{it.lineExpiry ? ` · ${t('exp', { date: it.lineExpiry.toISOString().slice(0, 7) })}` : ''}</span>
              <span className="font-medium">{formatEGP(Number(it.unitPricePiastres) * it.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>{t('shipping')}</span><span>{Number(order.shippingPiastres) === 0 ? t('free') : formatEGP(Number(order.shippingPiastres))}</span></div>
          <div className="flex justify-between font-semibold"><span>{t('total')}</span><span>{formatEGP(Number(order.totalPiastres))}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>{t('payment')}</span><span>{order.paymentMethod ? (tPay.has(order.paymentMethod) ? tPay(order.paymentMethod) : order.paymentMethod) : '—'}</span></div>
        </div>
      </div>

      <Link href="/products" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">{t('continueShopping')}</Link>
    </div>
  );
}
