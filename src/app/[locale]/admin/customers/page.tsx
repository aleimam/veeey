import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { assignTierAction } from '@/server/loyalty-actions';
import { formatEGP } from '@/lib/format';
import { inputCls } from '@/components/admin/ui';

export default async function CustomersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [customers, tiers] = await Promise.all([
    prisma.customer.findMany({ include: { user: { select: { email: true } }, tier: true }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.tier.findMany({ orderBy: { rank: 'asc' } }),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">العملاء ({customers.length})</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">البريد الإلكتروني</th><th className="p-3 text-start">الفئة</th><th className="p-3 text-start">النقاط</th><th className="p-3 text-start">إجمالي الإنفاق</th></tr>
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
                      <option value="">— بدون —</option>
                      {tiers.map((t) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}
                    </select>
                    <button className="text-xs text-primary hover:underline">تعيين</button>
                  </form>
                </td>
                <td className="p-3">{c.pointsBalance.toLocaleString('en-US')}</td>
                <td className="p-3">{formatEGP(Number(c.lifetimeSpendPiastres))}</td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا يوجد عملاء بعد.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
