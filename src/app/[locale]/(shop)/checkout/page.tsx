import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { readCartId, getCart } from '@/lib/cart-service';
import { listShippingTypes } from '@/lib/shipping-service';
import { enabledCustomerMethods } from '@/lib/payment-method-service';
import { getNumberSetting } from '@/lib/settings-service';
import { pick } from '@/lib/admin-i18n';
import { getCurrentUser } from '@/lib/auth-guards';
import { listAddresses } from '@/lib/address-service';
import { prisma } from '@/lib/prisma';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { TrackView } from '@/components/analytics/track-view';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cartId = await readCartId();
  const lines = cartId ? await getCart(cartId, locale) : [];
  if (lines.length === 0) redirect(`/${locale}/cart`);

  const subtotal = lines.reduce((s, l) => s + l.subtotalPiastres, 0);
  const hasPreorder = lines.some((l) => l.preorder);
  const [types, user] = await Promise.all([listShippingTypes(), getCurrentUser()]);
  const customer = user?.customerId ? await prisma.customer.findUnique({ where: { id: user.customerId } }) : null;
  const savedAddresses = user?.customerId
    ? (await listAddresses(user.customerId)).map((a) => ({ id: a.id, governorate: a.governorate, city: a.city, area: a.area, street: a.street, phone: a.phone }))
    : [];

  const tp = await getTranslations('storefront.checkout');
  const tb = pick(locale);
  const pointsPerEgp = await getNumberSetting('loyalty.redeemPointsPerEgp');
  const depositPercent = await getNumberSetting('preorder.depositPercent');
  const methods = enabledCustomerMethods(locale, { posAllowed: true }); // POS gated per-governorate in the form
  const posAreas = await prisma.shippingArea.findMany({ where: { allowsPos: true }, select: { zone: { select: { governorate: true } } } });
  const posGovernorates = [...new Set(posAreas.map((a) => a.zone.governorate))];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <TrackView name="checkout_step" props={{ step: 'start' }} />
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{tp('title')}</h1>
      {hasPreorder && (
        <div className="mb-6 rounded-[12px] border border-[color:var(--gold)] bg-gold-wash px-4 py-3 text-sm text-ink" role="note">
          {tb(
            `Your order includes a pre-order item. You'll pay a ${depositPercent}% deposit now and the balance on delivery; the whole order ships together when the pre-order stock arrives.`,
            `يتضمّن طلبك منتجًا بالطلب المسبق. ستدفع عربونًا بنسبة ${depositPercent}٪ الآن والباقي عند التوصيل؛ ويُشحن الطلب كاملًا معًا حين يتوفّر مخزون الطلب المسبق.`,
          )}
        </div>
      )}
      <CheckoutForm
        locale={locale}
        isLoggedIn={!!user}
        defaultName={user?.name ?? undefined}
        subtotalPiastres={subtotal}
        shippingOptions={types.map((s) => ({ type: s.type, label: (locale === 'ar' ? s.labelAr : s.labelEn) ?? s.labelEn, feePiastres: Number(s.feePiastres) }))}
        paymentMethods={methods.map((m) => ({ key: m.code, label: m.label }))}
        posGovernorates={posGovernorates}
        pointsBalance={customer?.pointsBalance ?? 0}
        pointsPerEgp={pointsPerEgp}
        savedAddresses={savedAddresses}
      />
    </div>
  );
}
