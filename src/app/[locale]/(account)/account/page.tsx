import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';
import { signOutAction } from '@/server/auth-actions';
import { buyAgainAction } from '@/server/cart-actions';
import { listReturnReasons } from '@/lib/return-reason-service';
import { reorderSuggestions } from '@/lib/replenishment-service';
import { isFeatureEnabled } from '@/lib/feature-service';
import { ReturnRequestForm } from '@/components/storefront/return-request-form';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { formatEGP } from '@/lib/format';
import { StatusBadge } from '@/components/admin/ui';
import { Icon } from '@/components/storefront/ui/icon';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';

/** Module-level so the render body stays pure (react-hooks/purity). */
const currentDate = () => new Date();

const card = 'rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)]';

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;

  const [orders, customer, whatsapp, returnReasons] = await Promise.all([
    user.customerId
      ? prisma.order.findMany({ where: { customerId: user.customerId }, orderBy: { placedAt: 'desc' }, take: 20, include: { _count: { select: { items: true } } } })
      : Promise.resolve([]),
    user.customerId ? prisma.customer.findUnique({ where: { id: user.customerId }, include: { tier: true } }) : Promise.resolve(null),
    getSetting('store.whatsappNumber'),
    listReturnReasons(true),
  ]);
  const reasonOptions = returnReasons.map((r) => ({ id: r.id, label: locale === 'ar' ? r.labelAr : r.labelEn, requiresDetail: r.requiresDetail }));

  const reorders = user.customerId && (await isFeatureEnabled('buyAgain')) ? await reorderSuggestions(user.customerId, locale, currentDate()) : [];
  const t = await getTranslations('storefront.account');
  const tb = pick(locale);

  const displayName = user.name || user.email?.split('@')[0] || t('title');
  const initial = (user.name || user.email || 'V').slice(0, 1).toUpperCase();
  const memberSince = customer ? customer.createdAt.getUTCFullYear() : null;
  const tierName = customer ? ((locale === 'ar' ? customer.tier?.nameAr : customer.tier?.nameEn) ?? null) : null;
  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}` : null;

  const nav: { icon: string; label: string; href: string; active?: boolean; hash?: boolean }[] = [
    { icon: 'layout-dashboard', label: tb('Overview', 'نظرة عامة'), href: '/account', active: true },
    { icon: 'repeat', label: tb('Veeey Refill', 'فيي ريفيل'), href: '/refill' },
    { icon: 'package', label: tb('Orders', 'الطلبات'), href: '#orders', hash: true },
    { icon: 'heart', label: tb('Saved items', 'المحفوظات'), href: '/wishlist' },
    { icon: 'map-pin', label: t('addresses.manage'), href: '/account/addresses' },
    { icon: 'bell', label: t('notifications'), href: '/account/notifications' },
    { icon: 'house', label: t('store'), href: '/' },
  ];

  return (
    <div style={{ background: 'var(--surface)' }} className="min-h-[60vh]">
      {/* profile header */}
      <section style={{ background: 'linear-gradient(140deg,var(--green-dark),var(--green-emerald))' }} className="text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-[22px] px-4 py-9 sm:px-6 lg:px-8">
          <span className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-lime bg-white/14 text-[34px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{initial}</span>
          <div className="min-w-[200px] flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[30px] font-bold" style={{ fontFamily: 'var(--font-display)' }}>{displayName}</h1>
              {tierName && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold" style={{ color: customer?.tier?.color ?? '#fff' }}>
                  <Icon name="crown" size={14} color={customer?.tier?.color ?? '#fff'} /> {tierName}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-white/80">
              {memberSince ? tb(`Member since ${memberSince}`, `عضو منذ ${memberSince}`) : user.email}
            </div>
          </div>
          {customer && (
            <div className="flex gap-7">
              <div>
                <div className="text-[26px] font-bold text-lime" style={{ fontFamily: 'var(--font-display)' }}>★ {customer.pointsBalance.toLocaleString('en-US')}</div>
                <div className="text-[12.5px] text-white/80">{t('points')}</div>
              </div>
              <div>
                <div className="text-[26px] font-bold text-lime" style={{ fontFamily: 'var(--font-display)' }}>{orders.length}</div>
                <div className="text-[12.5px] text-white/80">{tb('Orders', 'الطلبات')}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-[1440px] items-start gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-8">
        {/* sidebar */}
        <aside className="flex flex-col gap-5">
          <nav className="rounded-[16px] border border-[color:var(--green-dark-05)] bg-white p-2.5">
            {nav.map((n) => {
              const cls = `flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[14.5px] ${
                n.active ? 'bg-green-wash font-bold text-green-dark' : 'font-medium text-slate hover:bg-surface'
              }`;
              const inner = (
                <>
                  <Icon name={n.icon} size={19} color={n.active ? 'var(--green-dark)' : 'var(--slate-70)'} /> {n.label}
                </>
              );
              return n.hash ? (
                <a key={n.label} href={n.href} className={cls}>{inner}</a>
              ) : (
                <Link key={n.label} href={n.href} className={cls}>{inner}</Link>
              );
            })}
          </nav>

          {customer && (
            <div className={card}>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-green-mid">{t('referralCode')}</div>
              <div className="font-mono text-lg font-bold text-ink">{customer.referralCode}</div>
              <div className="mt-1 text-xs text-[color:var(--text-muted)]">{t('referralNote')}</div>
              <a href={`/${locale}/register?ref=${customer.referralCode}`} className="mt-1 block break-all text-xs text-green-dark hover:text-lime-press">{`/${locale}/register?ref=${customer.referralCode}`}</a>
            </div>
          )}

          <form action={signOutAction}><button className="v-btn v-btn--secondary v-btn--block">{t('signOut')}</button></form>
        </aside>

        {/* main */}
        <main className="flex flex-col gap-6">
          {customer && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={card}>
                <div className="text-sm text-[color:var(--text-muted)]">{t('tier')}</div>
                <div className="mt-1 text-lg font-bold" style={{ color: customer.tier?.color ?? undefined }}>{tierName ?? '—'}</div>
              </div>
              <div className={card}>
                <div className="text-sm text-[color:var(--text-muted)]">{t('points')}</div>
                <div className="mt-1 text-lg font-bold text-green-dark">{customer.pointsBalance.toLocaleString('en-US')}</div>
                <div className="text-xs text-[color:var(--text-muted)]">{t('pointsNote')}</div>
              </div>
            </div>
          )}

          {reorders.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[22px] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('reorderTitle')}</h2>
                <Link href="/products" className="text-[13.5px] font-bold text-green-dark hover:text-lime-press">{tb('See more', 'المزيد')} →</Link>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {reorders.slice(0, 4).map((r) => (
                  <div key={r.product.slug} className="space-y-1">
                    <ChewyProductCard product={r.product} locale={locale} />
                    <p className={`text-xs ${r.daysLeft <= 0 ? 'font-semibold text-error' : 'text-[color:var(--text-muted)]'}`}>
                      {r.daysLeft <= 0 ? t('runOut') : t('daysLeft', { days: r.daysLeft })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* order history */}
          <div id="orders" className="scroll-mt-[130px] rounded-[18px] border border-[color:var(--green-dark-05)] bg-white p-6">
            <h2 className="mb-4 text-[22px] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('orderHistory')}</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-[color:var(--text-muted)]">
                {t('noOrders')} <Link href="/products" className="font-semibold text-green-dark hover:text-lime-press">{t('startShopping')}</Link>.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[12px] border border-[color:var(--slate-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-xs uppercase text-[color:var(--text-muted)]">
                    <tr>
                      <th className="p-3 text-start">{t('colOrder')}</th>
                      <th className="p-3 text-start">{t('colItems')}</th>
                      <th className="p-3 text-start">{t('colTotal')}</th>
                      <th className="p-3 text-start">{t('colStatus')}</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-t border-[color:var(--slate-border)]">
                        <td className="p-3 font-semibold text-ink">{o.number}</td>
                        <td className="p-3 text-ink">{o._count.items}</td>
                        <td className="p-3 text-ink">{formatEGP(Number(o.totalPiastres))}</td>
                        <td className="p-3"><StatusBadge status={o.customerStatus ?? o.status} /></td>
                        <td className="p-3 text-end">
                          <form action={buyAgainAction} className="mb-1.5 inline-block">
                            <input type="hidden" name="locale" value={locale} />
                            <input type="hidden" name="orderId" value={o.id} />
                            <button type="submit" className="rounded-full border border-[color:var(--green-dark-12)] px-3 py-1.5 text-xs font-semibold text-green-dark hover:bg-[color:var(--green-wash)]">
                              {tb('Buy again', 'اطلب مجددًا')}
                            </button>
                          </form>
                          {o.status === 'DELIVERED' && reasonOptions.length > 0 && (
                            <ReturnRequestForm
                              orderId={o.id}
                              locale={locale}
                              reasons={reasonOptions}
                              labels={{
                                submit: t('requestReturn'),
                                choose: tb('Reason for return', 'سبب الإرجاع'),
                                detail: tb('Please add a few details', 'يرجى إضافة بعض التفاصيل'),
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* talk to a pharmacist */}
          <div className="flex flex-wrap items-center gap-5 rounded-[18px] border border-[color:var(--green-dark-12)] p-6" style={{ background: 'linear-gradient(110deg,var(--green-wash),#fff)' }}>
            <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-green-dark">
              <Icon name="stethoscope" size={28} color="var(--lime)" />
            </span>
            <div className="min-w-[220px] flex-1">
              <div className="text-[22px] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{tb('Questions about your routine?', 'أسئلة عن روتينك؟')}</div>
              <div className="mt-1 text-sm text-[color:var(--text-muted)]">{tb('Chat free with a licensed Veeey pharmacist on WhatsApp — honest, no-pressure advice.', 'تحدّث مجانًا مع صيدلي فيي مرخّص على واتساب — نصيحة صادقة وبلا ضغط.')}</div>
            </div>
            {waHref ? (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="v-btn v-btn--primary">
                <span className="v-btn__icon" aria-hidden="true"><Icon name="messages-square" size={18} /></span>
                {tb('Talk to a pharmacist', 'تحدّث إلى صيدلي')}
              </a>
            ) : (
              <Link href="/special-order" className="v-btn v-btn--primary">
                <span className="v-btn__icon" aria-hidden="true"><Icon name="messages-square" size={18} /></span>
                {tb('Talk to a pharmacist', 'تحدّث إلى صيدلي')}
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
