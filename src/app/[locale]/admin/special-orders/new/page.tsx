import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SpecialOrderCreateForm } from '@/components/admin/special-order-create-form';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

export default async function NewSpecialOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  return (
    <div className="p-6">
      <Link href="/admin/special-orders" className="text-sm text-primary hover:underline">← {tb('Special orders', 'الطلبات الخاصة')}</Link>
      <h1 className="mt-2 mb-6 font-heading text-xl font-semibold">{tb('Create special order', 'إنشاء طلب خاص')}</h1>
      <SpecialOrderCreateForm locale={locale} />
    </div>
  );
}
