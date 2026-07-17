import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getNumberSetting } from '@/lib/settings-service';
import { RequestForm } from '@/components/admin/request-form';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export default async function NewRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  await requirePermission('requests.manage');
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const depositPercent = await getNumberSetting('specialOrder.depositPercent');

  return (
    <div className="p-6">
      <Link href="/admin/requests" className="text-sm text-primary hover:underline">← {tb('Requests', 'الطلبات')}</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{tb('New request', 'طلب جديد')}</h1>
      <RequestForm depositPercent={depositPercent} />
    </div>
  );
}
