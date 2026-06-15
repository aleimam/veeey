import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth-guards';
import { getNumberSetting } from '@/lib/settings-service';
import { SpecialOrderForm } from '@/components/storefront/special-order-form';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SpecialOrderPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('storefront.specialOrderForm');
  const [user, deposit, leadDays] = await Promise.all([
    getCurrentUser().catch(() => null),
    getNumberSetting('specialOrder.depositPercent'),
    getNumberSetting('specialOrder.defaultLeadDays'),
  ]);
  const submitted = one(sp.submitted) === '1';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">{t('title')}</h1>
      <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">{t('intro')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t('terms', { percent: deposit, days: leadDays })}</p>

      {submitted ? (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
          <p className="text-lg font-medium text-foreground">{t('submittedTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('submittedNote')}</p>
        </div>
      ) : (
        <SpecialOrderForm locale={locale} defaultName={user?.name ?? undefined} defaultEmail={user?.email ?? undefined} />
      )}
    </div>
  );
}
