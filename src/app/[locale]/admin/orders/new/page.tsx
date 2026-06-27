import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { listShippingTypes } from '@/lib/shipping-service';
import { enabledCustomerMethods } from '@/lib/payment-method-service';
import { ManualOrderForm } from '@/components/admin/manual-order-form';
import { pick } from '@/lib/admin-i18n';

export default async function NewOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const [products, shippingTypes] = await Promise.all([
    prisma.product.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, nameEn: true, sku: true }, orderBy: { nameEn: 'asc' } }),
    listShippingTypes(),
  ]);
  const methods = enabledCustomerMethods(locale, { posAllowed: true }); // staff may pick any method

  return (
    <div className="p-6">
      <Link href="/admin/orders" className="text-sm text-primary hover:underline">← {tb('Orders', 'الطلبات')}</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{tb('New order', 'طلب جديد')}</h1>
      <ManualOrderForm
        locale={locale}
        products={products.map((p) => ({ value: p.id, label: `${p.nameEn} (${p.sku})` }))}
        shippingTypes={shippingTypes.map((s) => ({ value: s.type, label: s.labelEn }))}
        paymentMethods={methods.map((m) => ({ value: m.code, label: m.label }))}
      />
    </div>
  );
}
