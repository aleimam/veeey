import { redirect } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { readCartId, getCart } from '@/lib/cart-service';
import { listShippingTypes } from '@/lib/shipping-service';
import { enabledPaymentMethods } from '@/lib/payments';
import { getNumberSetting } from '@/lib/settings-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { listAddresses } from '@/lib/address-service';
import { prisma } from '@/lib/prisma';
import { CheckoutForm } from '@/components/storefront/checkout-form';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const cartId = await readCartId();
  const lines = cartId ? await getCart(cartId, locale) : [];
  if (lines.length === 0) redirect(`/${locale}/cart`);

  const subtotal = lines.reduce((s, l) => s + l.subtotalPiastres, 0);
  const [types, user] = await Promise.all([listShippingTypes(), getCurrentUser()]);
  const customer = user?.customerId ? await prisma.customer.findUnique({ where: { id: user.customerId } }) : null;
  const savedAddresses = user?.customerId
    ? (await listAddresses(user.customerId)).map((a) => ({ id: a.id, governorate: a.governorate, city: a.city, area: a.area, street: a.street, phone: a.phone }))
    : [];

  const tp = await getTranslations('storefront.checkout');
  const pointsPerEgp = await getNumberSetting('loyalty.redeemPointsPerEgp');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold text-green-dark">{tp('title')}</h1>
      <CheckoutForm
        locale={locale}
        isLoggedIn={!!user}
        defaultName={user?.name ?? undefined}
        subtotalPiastres={subtotal}
        shippingOptions={types.map((s) => ({ type: s.type, label: (locale === 'ar' ? s.labelAr : s.labelEn) ?? s.labelEn, feePiastres: Number(s.feePiastres) }))}
        paymentMethods={enabledPaymentMethods().map((m) => ({ key: m.key, label: m.label }))}
        pointsBalance={customer?.pointsBalance ?? 0}
        pointsPerEgp={pointsPerEgp}
        savedAddresses={savedAddresses}
      />
    </div>
  );
}
