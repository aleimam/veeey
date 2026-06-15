import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { signOutAction } from '@/server/auth-actions';
import { requestReturnAction } from '@/server/account-actions';
import { reorderSuggestions } from '@/lib/replenishment-service';
import { ProductCard } from '@/components/storefront/product-card';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

/** Module-level so the render body stays pure (react-hooks/purity). */
const currentDate = () => new Date();

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;

  const [orders, customer] = await Promise.all([
    user.customerId
      ? prisma.order.findMany({ where: { customerId: user.customerId }, orderBy: { placedAt: 'desc' }, take: 20, include: { _count: { select: { items: true } } } })
      : Promise.resolve([]),
    user.customerId ? prisma.customer.findUnique({ where: { id: user.customerId }, include: { tier: true } }) : Promise.resolve(null),
  ]);

  const reorders = user.customerId ? await reorderSuggestions(user.customerId, locale, currentDate()) : [];
  const t = await getTranslations('storefront.account');

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/account/notifications" className="text-sm text-primary hover:underline">{t('notifications')}</Link>
          <Link href="/" className="text-sm text-primary hover:underline">{t('store')}</Link>
          <form action={signOutAction}><button className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{t('signOut')}</button></form>
        </div>
      </div>

      {customer && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{t('tier')}</div>
            <div className="mt-1 text-lg font-semibold" style={{ color: customer.tier?.color ?? undefined }}>{(locale === 'ar' ? customer.tier?.nameAr : customer.tier?.nameEn) ?? '—'}</div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{t('points')}</div>
            <div className="mt-1 text-lg font-semibold text-primary">{customer.pointsBalance.toLocaleString('en-US')}</div>
            <div className="text-xs text-muted-foreground">{t('pointsNote')}</div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">{t('referralCode')}</div>
            <div className="mt-1 font-mono text-lg font-semibold text-foreground">{customer.referralCode}</div>
            <div className="text-xs text-muted-foreground">{t('referralNote')}</div>
            <a href={`/${locale}/register?ref=${customer.referralCode}`} className="mt-1 block break-all text-xs text-primary hover:underline">{`/${locale}/register?ref=${customer.referralCode}`}</a>
          </div>
        </div>
      )}

      {reorders.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-heading text-lg font-semibold">{t('reorderTitle')}</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {reorders.slice(0, 4).map((r) => (
              <div key={r.product.slug} className="space-y-1">
                <ProductCard product={r.product} locale={locale} />
                <p className={`text-xs ${r.daysLeft <= 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                  {r.daysLeft <= 0 ? t('runOut') : t('daysLeft', { days: r.daysLeft })}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="mb-3 font-heading text-lg font-semibold">{t('orderHistory')}</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noOrders')} <Link href="/products" className="text-primary hover:underline">{t('startShopping')}</Link>.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr><th className="p-3 text-start">{t('colOrder')}</th><th className="p-3 text-start">{t('colItems')}</th><th className="p-3 text-start">{t('colTotal')}</th><th className="p-3 text-start">{t('colStatus')}</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3 font-medium">{o.number}</td>
                  <td className="p-3">{o._count.items}</td>
                  <td className="p-3">{formatEGP(Number(o.totalPiastres))}</td>
                  <td className="p-3"><StatusBadge status={o.status} /></td>
                  <td className="p-3 text-end">
                    {(o.status === 'CASH_DELIVERED' || o.status === 'CARD_DELIVERED') && (
                      <form action={requestReturnAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="orderId" value={o.id} />
                        <button className="text-xs text-primary hover:underline">{t('requestReturn')}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
