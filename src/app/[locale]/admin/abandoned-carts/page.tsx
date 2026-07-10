import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { getSetting } from '@/lib/settings-service';
import { abandonedCartOverview } from '@/lib/abandoned-cart-service';

export const dynamic = 'force-dynamic';

export default async function AbandonedCartsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'customers.read')) redirect({ href: '/admin', locale });

  const [data, enabled, idleHours] = await Promise.all([
    abandonedCartOverview(50),
    getSetting('cart.abandonedReminderEnabled'),
    getSetting('cart.abandonedIdleHours'),
  ]);
  const on = enabled.toLowerCase() === 'true';

  const card = 'rounded-xl border border-border bg-card p-4';
  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm';
  const fmtAgo = (h: number) => {
    if (h < 1) return tb('< 1h', 'أقل من ساعة');
    if (h < 24) return tb(`${h}h`, `${h} س`);
    return tb(`${Math.floor(h / 24)}d`, `${Math.floor(h / 24)} ي`);
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 font-heading text-xl font-semibold text-foreground">{tb('Abandoned carts', 'السلات المتروكة')}</h1>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {tb(
          `Signed-in customers who left items in their cart. When enabled, one reminder email is sent after a cart sits idle for ${idleHours} hour(s). Guest (not signed-in) carts can't be emailed. Configure in Settings › Cart.`,
          `عملاء مسجّلون تركوا منتجات في سلّتهم. عند التفعيل، يُرسَل تذكير واحد بعد بقاء السلة دون نشاط ${idleHours} ساعة. لا يمكن مراسلة سلات الزوّار غير المسجّلين. اضبط ذلك من الإعدادات › السلة.`,
        )}
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className={card}><div className="text-xs text-muted-foreground">{tb('Open carts', 'سلات مفتوحة')}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{data.total}</div></div>
        <div className={card}><div className="text-xs text-muted-foreground">{tb('Value at risk', 'قيمة معرّضة')}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatEGP(data.valuePiastres)}</div></div>
        <div className={card}><div className="text-xs text-muted-foreground">{tb('Reminders sent', 'تذكيرات مُرسَلة')}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{data.reminded}</div></div>
      </div>

      {!on && <div className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{tb('Reminders are turned off. Turn on “Abandoned-cart reminders” in Settings › Cart to start sending.', 'التذكيرات متوقّفة. فعّل «تذكيرات السلة المتروكة» من الإعدادات › السلة لبدء الإرسال.')}</div>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className={th}>{tb('Customer', 'العميل')}</th>
              <th className={`${th} text-end`}>{tb('Items', 'عناصر')}</th>
              <th className={`${th} text-end`}>{tb('Subtotal', 'الإجمالي')}</th>
              <th className={`${th} text-end`}>{tb('Idle', 'خامل')}</th>
              <th className={th}>{tb('Reminder', 'تذكير')}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">{tb('No open carts right now.', 'لا سلات مفتوحة حاليًا.')}</td></tr>}
            {data.rows.map((r) => {
              const name = r.customer?.user.name || [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(' ') || r.customer?.user.email || '—';
              return (
                <tr key={r.customerId} className="border-b border-border last:border-0">
                  <td className={td}><div className="font-medium text-foreground">{name}</div><div className="text-xs text-muted-foreground">{r.customer?.user.email}</div></td>
                  <td className={`${td} text-end tabular-nums`}>{r.itemCount}</td>
                  <td className={`${td} text-end tabular-nums`}>{formatEGP(Number(r.subtotalPiastres))}</td>
                  <td className={`${td} text-end tabular-nums text-muted-foreground`}>{fmtAgo(r.ageHours)}</td>
                  <td className={td}>{r.reminderSentAt ? <span className="text-primary">{tb('sent', 'مُرسَل')}</span> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
