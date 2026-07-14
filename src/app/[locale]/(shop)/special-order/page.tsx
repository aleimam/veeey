import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireFeature } from '@/lib/feature-service';
import { getCurrentUser } from '@/lib/auth-guards';
import { getNumberSetting } from '@/lib/settings-service';
import { prisma } from '@/lib/prisma';
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
  // A logged-in account may have no phone on file; the action requires one, so
  // surface the phone field instead of dead-ending on a BAD_PHONE error the
  // hidden-contact form couldn't fix.
  const acctPhone = user ? (await prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone : null;
  const needsPhone = !!user && !acctPhone;

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
        <SpecialOrderForm locale={locale} isLoggedIn={!!user} needsPhone={needsPhone} defaultName={user?.name ?? undefined} defaultEmail={user?.email ?? undefined} />
      )}
    </div>
  );
}
