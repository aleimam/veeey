import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { getPrefs } from '@/lib/notification-service';
import { saveNotificationPrefsAction } from '@/server/notification-actions';
import { PushOptIn } from '@/components/account/push-opt-in';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect({ href: '/login', locale });
  if (!user?.customerId) return null;

  const prefs = await getPrefs(user.customerId);
  const t = await getTranslations('storefront.accountNotif');
  const rows = [
    { name: 'email', label: t('email'), checked: prefs.email },
    { name: 'push', label: t('push'), checked: prefs.push },
    { name: 'orderUpdates', label: t('orderUpdates'), checked: prefs.orderUpdates },
    { name: 'priceDrop', label: t('priceDrop'), checked: prefs.priceDrop },
    { name: 'backInStock', label: t('backInStock'), checked: prefs.backInStock },
    { name: 'marketing', label: t('marketing'), checked: prefs.marketing },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/account" className="text-sm font-semibold text-green-dark hover:text-lime-press">{t('back')}</Link>
      <h1 className="mt-2 text-3xl font-bold text-green-dark">{t('title')}</h1>

      <form action={saveNotificationPrefsAction} className="mt-6 space-y-2">
        <input type="hidden" name="locale" value={locale} />
        {rows.map((r) => (
          <label key={r.name} className="flex items-center gap-3 rounded-[10px] border border-[color:var(--slate-border)] p-3 text-sm text-ink">
            <input type="checkbox" name={r.name} defaultChecked={r.checked} className="size-4 accent-[color:var(--green-dark)]" /> {r.label}
          </label>
        ))}
        <button className="v-btn v-btn--primary mt-2">{t('save')}</button>
      </form>

      <div className="mt-8">
        <p className="mb-2 text-sm font-semibold text-ink">{t('pushOnDevice')}</p>
        <PushOptIn vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
      </div>
    </main>
  );
}
