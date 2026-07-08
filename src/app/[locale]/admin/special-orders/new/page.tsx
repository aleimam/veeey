import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SpecialOrderCreateForm } from '@/components/admin/special-order-create-form';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

export default async function NewSpecialOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('orders.write');
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
