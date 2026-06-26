import { setRequestLocale } from 'next-intl/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { assignTierAction } from '@/server/loyalty-actions';
import { bulkCustomersAction } from '@/server/bulk-actions';
import { formatEGP } from '@/lib/format';
import { inputCls } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const SORTABLE = ['email', 'tier', 'points', 'spend', 'createdAt'] as const;

function customerOrderBy(sort: string, dir: 'asc' | 'desc'): Prisma.CustomerOrderByWithRelationInput {
  switch (sort) {
    case 'email': return { user: { email: dir } };
    case 'points': return { pointsBalance: dir };
    case 'spend': return { lifetimeSpendPiastres: dir };
    case 'tier': return { tier: { rank: dir } };
    default: return { createdAt: dir };
  }
}

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const tier = one(sp.tier);
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: SORTABLE, defaultSort: 'createdAt' });

  const where: Prisma.CustomerWhereInput = {
    ...(tier ? { tierId: tier } : {}),
    ...(q
      ? { OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { user: { phone: { contains: q, mode: 'insensitive' } } },
        ] }
      : {}),
  };

  const [customers, total, tiers] = await Promise.all([
    prisma.customer.findMany({ where, include: { user: { select: { email: true, phone: true } }, tier: true }, orderBy: customerOrderBy(sort, dir), skip: (page - 1) * perPage, take: perPage }),
    prisma.customer.count({ where }),
    prisma.tier.findMany({ orderBy: { rank: 'asc' } }),
  ]);

  const basePath = `/${locale}/admin/customers`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, error: undefined })}`;
  const done = one(sp.done);

  const ops: BulkOp[] = [
    { value: 'tier', label: tb('Assign tier', 'تعيين الفئة'), values: [{ value: '__none__', label: tb('— None —', '— بدون —') }, ...tiers.map((t) => ({ value: t.id, label: t.nameEn }))] },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">{tb('Customers', 'العملاء')} ({total})</h1>
        <ExportBar entity="customers" locale={locale} query={exportQs(sp)} />
      </header>

      {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Updated ${done} customer(s).`, `تم تحديث ${done} عميل.`)}</p>}
      {one(sp.error) === 'bulk' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Bulk action failed.', 'فشل الإجراء الجماعي.')}</p>}

      <FilterBar
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Name / email / phone', 'الاسم / البريد / الهاتف') },
          { name: 'tier', label: tb('Tier', 'الفئة'), type: 'select', options: tiers.map((t) => ({ value: t.id, label: t.nameEn })) },
        ]}
        values={{ q, tier }}
        locale={locale}
        path="customers"
      />

      <BulkBar
        formId="bulk-customers"
        action={bulkCustomersAction}
        locale={locale}
        back={back}
        ops={ops}
        exportHref="/api/admin/export/customers"
        labels={{ selectAllPage: tb('Select page', 'تحديد الصفحة'), selected: tb('selected', 'محدد'), apply: tb('Apply', 'تطبيق'), exportSel: tb('Export selected', 'تصدير المحدد'), confirmDanger: tb('Apply to the selected customers?', 'تطبيق على العملاء المحددين؟'), needValue: tb('Choose a value first.', 'اختر قيمة أولًا.') }}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="w-8 p-3" />
              <SortableTh col="email" label={tb('Email', 'البريد الإلكتروني')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="tier" label={tb('Tier', 'الفئة')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="points" label={tb('Points', 'النقاط')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="spend" label={tb('Total spend', 'إجمالي الإنفاق')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={c.id} form="bulk-customers" className="size-4" aria-label={c.user.email ?? c.id} /></td>
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
            {customers.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tb('No customers match.', 'لا يوجد عملاء مطابقون.')}</td></tr>}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
