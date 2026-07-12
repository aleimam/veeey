import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireFeature } from '@/lib/feature-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { getNumberSetting } from '@/lib/settings-service';
import { SpecialOrderForm } from '@/components/storefront/special-order-form';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SpecialOrderPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireFeature('specialOrders', locale);
  const t = await getTranslations('storefront.specialOrderForm');
  const [user, deposit, leadDays] = await Promise.all([
    getCurrentUser().catch(() => null),
    getNumberSetting('specialOrder.depositPercent'),
    getNumberSetting('specialOrder.defaultLeadDays'),
  ]);
  const submitted = one(sp.submitted) === '1';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-green-dark sm:text-4xl">{t('title')}</h1>
      <p className="mt-3 leading-relaxed text-[color:var(--text-muted)]">{t('intro')}</p>
      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('terms', { percent: deposit, days: leadDays })}</p>

      {submitted ? (
        <div className="mt-8 rounded-[16px] border border-[color:var(--green-dark-12)] bg-green-wash p-6">
          <p className="text-lg font-bold text-green-dark">{t('submittedTitle')}</p>
          <p className="mt-1 text-sm text-ink">{t('submittedNote')}</p>
        </div>
      ) : (
        <SpecialOrderForm locale={locale} isLoggedIn={!!user} defaultName={user?.name ?? undefined} defaultEmail={user?.email ?? undefined} />
      )}
    </div>
  );
}
