import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { assignTierAction } from '@/server/loyalty-actions';
import { formatEGP } from '@/lib/format';
import { inputCls } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const tier = one(sp.tier);
  const where = {
    ...(tier ? { tierId: tier } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { user: { email: { contains: q, mode: 'insensitive' as const } } },
            { user: { phone: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };
  const [customers, tiers] = await Promise.all([
    prisma.customer.findMany({ where, include: { user: { select: { email: true, phone: true } }, tier: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.tier.findMany({ orderBy: { rank: 'asc' } }),
  ]);

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">{tb('Customers', 'العملاء')} ({customers.length})</h1>
        <ExportBar entity="customers" locale={locale} query={exportQs(sp)} />
      </header>
      <FilterBar
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Name / email / phone', 'الاسم / البريد / الهاتف') },
          { name: 'tier', label: tb('Tier', 'الفئة'), type: 'select', options: tiers.map((t) => ({ value: t.id, label: t.nameEn })) },
        ]}
        values={{ q, tier }}
        locale={locale}
        path="customers"
      />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">{tb('Email', 'البريد الإلكتروني')}</th><th className="p-3 text-start">{tb('Tier', 'الفئة')}</th><th className="p-3 text-start">{tb('Points', 'النقاط')}</th><th className="p-3 text-start">{tb('Total spend', 'إجمالي الإنفاق')}</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3">{c.user.email}</td>
                <td className="p-3">
                  <form action={assignTierAction} className="flex items-center gap-2">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="customerId" value={c.id} />
                    <select name="tierId" defaultValue={c.tierId ?? ''} className={`${inputCls} w-36`}>
                      <option value="">{tb('— None —', '— بدون —')}</option>
                      {tiers.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}
                    </select>
                    <button className="text-xs text-primary hover:underline">{tb('Assign', 'تعيين')}</button>
                  </form>
                </td>
                <td className="p-3">{c.pointsBalance.toLocaleString('en-US')}</td>
                <td className="p-3">{formatEGP(Number(c.lifetimeSpendPiastres))}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{tb('No customers yet.', 'لا يوجد عملاء بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
