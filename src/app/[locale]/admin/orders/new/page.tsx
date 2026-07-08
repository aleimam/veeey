import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listShippingTypes } from '@/lib/shipping-service';
import { enabledCustomerMethods } from '@/lib/payment-method-service';
import { getNumberSetting } from '@/lib/settings-service';
import { BACKEND_CHANNELS } from '@/lib/channels';
import { ManualOrderForm } from '@/components/admin/manual-order-form';
import { pick } from '@/lib/admin-i18n';

export default async function NewOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const [shippingTypes, depositPercent] = await Promise.all([
    listShippingTypes(),
    getNumberSetting('preorder.depositPercent'),
  ]);
  const methods = enabledCustomerMethods(locale, { posAllowed: true }); // staff may pick any method

  return (
    <div className="p-6">
      <Link href="/admin/orders" className="text-sm text-primary hover:underline">← {tb('Orders', 'الطلبات')}</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{tb('New order', 'طلب جديد')}</h1>
      <ManualOrderForm
        locale={locale}
        shippingTypes={shippingTypes.map((s) => ({ value: s.type, label: s.labelEn }))}
        paymentMethods={methods.map((m) => ({ value: m.code, label: m.label }))}
        channels={BACKEND_CHANNELS.map((c) => ({ value: c.code, label: locale === 'ar' ? c.ar : c.en }))}
        depositPercent={depositPercent}
      />
    </div>
  );
}
