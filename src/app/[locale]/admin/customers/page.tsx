import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { assignTierAction } from '@/server/loyalty-actions';
import { bulkCustomersAction } from '@/server/bulk-actions';
import { scanSuspiciousAction } from '@/server/customer-admin-actions';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { formatEGP } from '@/lib/format';
import { inputCls } from '@/components/admin/ui';
import { ExportBar, exportQs } from '@/components/admin/export-bar';
import { FilterBar } from '@/components/admin/filter-bar';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import { parseListParams, listQs, type SP } from '@/lib/admin-list';
import { getNumberSetting } from '@/lib/settings-service';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
const SORTABLE = ['email', 'tier', 'points', 'spend', 'orders', 'createdAt'] as const;

function customerOrderBy(sort: string, dir: 'asc' | 'desc'): Prisma.CustomerOrderByWithRelationInput {
  switch (sort) {
    case 'email': return { user: { email: dir } };
    case 'points': return { pointsBalance: dir };
    case 'spend': return { lifetimeSpendPiastres: dir };
    case 'tier': return { tier: { rank: dir } };
    case 'orders': return { orders: { _count: dir } };
    default: return { createdAt: dir };
  }
}

// Standing display (V5 F31): stored status wins; ACTIVE without any verified
// contact shows as "Unverified" (derived, not stored).
type StandingKey = 'ACTIVE' | 'UNVERIFIED' | 'FLAGGED' | 'BLOCKED';
const STANDING_CLS: Record<StandingKey, string> = {
  ACTIVE: 'bg-primary/10 text-primary',
  UNVERIFIED: 'bg-gold/20 text-slate',
  FLAGGED: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  BLOCKED: 'bg-destructive/10 text-destructive',
};
const standingOf = (status: string, emailVerified: Date | null, phoneVerified: Date | null): StandingKey =>
  status !== 'ACTIVE' ? (status as StandingKey) : emailVerified || phoneVerified ? 'ACTIVE' : 'UNVERIFIED';

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('customers.read');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const q = one(sp.q);
  const tier = one(sp.tier);
  const from = one(sp.from);
  const to = one(sp.to);
  const status = one(sp.status); // ACTIVE / UNVERIFIED / FLAGGED / BLOCKED (V5 F31)
  const seg = one(sp.seg); // orders/value segments (V5 F33)
  const { sort, dir, page, perPage } = parseListParams(sp, { sortable: SORTABLE, defaultSort: 'createdAt' });

  // Admin-configurable segment thresholds.
  const [highValueEgp, lapsedDays] = await Promise.all([
    getNumberSetting('customers.highValueEgp'),
    getNumberSetting('customers.lapsedDays'),
  ]);
  const lapsedCutoff = new Date();
  lapsedCutoff.setDate(lapsedCutoff.getDate() - lapsedDays);

  // "Repeat buyers" = 2+ orders. Prisma has no count filter, so resolve the ids.
  let repeatIds: string[] | null = null;
  if (seg === 'repeat') {
    const rows = await prisma.$queryRaw<{ customerId: string }[]>`
      SELECT "customerId" FROM "Order" WHERE "customerId" IS NOT NULL
      GROUP BY "customerId" HAVING COUNT(*) >= 2`;
    repeatIds = rows.map((r) => r.customerId);
  }

  const segWhere: Prisma.CustomerWhereInput =
    seg === 'no-orders' ? { orders: { none: {} } }
    : seg === 'with-orders' ? { orders: { some: {} } }
    : seg === 'repeat' ? { id: { in: repeatIds ?? [] } }
    : seg === 'high-value' ? { lifetimeSpendPiastres: { gte: BigInt(Math.round(highValueEgp * 100)) } }
    : seg === 'lapsed' ? { AND: [{ orders: { some: {} } }, { orders: { none: { placedAt: { gte: lapsedCutoff } } } }] }
    : {};

  const where: Prisma.CustomerWhereInput = {
    ...(tier ? { tierId: tier } : {}),
    ...(status === 'UNVERIFIED'
      ? { status: 'ACTIVE', user: { emailVerified: null, phoneVerified: null } }
      : status === 'ACTIVE' || status === 'FLAGGED' || status === 'BLOCKED'
        ? { status }
        : {}),
    ...segWhere,
    // Join-date range (drives the dashboard "New customers (month)" drill-down).
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}) } } : {}),
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
    prisma.customer.findMany({
      where,
      include: {
        user: { select: { email: true, phone: true, emailVerified: true, phoneVerified: true } },
        tier: true,
        _count: { select: { orders: true } },
        orders: { select: { placedAt: true }, orderBy: { placedAt: 'desc' }, take: 1 },
      },
      orderBy: customerOrderBy(sort, dir),
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.customer.count({ where }),
    prisma.tier.findMany({ orderBy: { rank: 'asc' } }),
  ]);

  const basePath = `/${locale}/admin/customers`;
  const back = `${basePath}${listQs(sp, { done: undefined, skip: undefined, error: undefined })}`;
  const done = one(sp.done);

  const ops: BulkOp[] = [
    { value: 'tier', label: tb('Assign tier', 'تعيين الفئة'), values: [{ value: '__none__', label: tb('— None —', '— بدون —') }, ...tiers.map((t) => ({ value: t.id, label: t.nameEn }))] },
    { value: 'status', label: tb('Set status', 'تعيين الحالة'), values: [
      { value: 'ACTIVE', label: tb('Active', 'نشط') },
      { value: 'FLAGGED', label: tb('Flagged', 'مُعلَّم') },
      { value: 'BLOCKED', label: tb('Blocked', 'محظور') },
    ] },
    { value: 'delete', label: tb('Delete (no orders only)', 'حذف (بلا طلبات فقط)'), danger: true },
  ];

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Customers', 'العملاء')} ({total})</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/customers/spam" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">
            {tb('Fake accounts', 'الحسابات الوهمية')}
          </Link>
          <form action={scanSuspiciousAction}>
            <input type="hidden" name="locale" value={locale} />
            <ConfirmButton
              warn={tb('Scan all active customers and flag suspicious accounts (throwaway or junk-farm emails, links/Cyrillic in the name, nameless or unverified with no orders, signup bursts)? Flagging is reversible.', 'فحص جميع العملاء النشطين وتعليم الحسابات المشبوهة (بريد مؤقت أو نطاق مشبوه، روابط أو حروف سيريلية في الاسم، بلا اسم أو غير مؤكد بلا طلبات، موجات تسجيل)؟ التعليم قابل للتراجع.')}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface"
            >
              {tb('Scan for suspicious', 'فحص الحسابات المشبوهة')}
            </ConfirmButton>
          </form>
          <ExportBar entity="customers" locale={locale} query={exportQs(sp)} />
        </div>
      </header>

      {done != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Done — ${done} customer(s).`, `تم — ${done} عميل.`)}{Number(one(sp.skip)) > 0 ? tb(` ${one(sp.skip)} kept (had orders / linked data).`, ` تم الإبقاء على ${one(sp.skip)} (لديهم طلبات/بيانات مرتبطة).`) : ''}</p>}
      {one(sp.flagged) != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Spam scan done — ${one(sp.flagged)} account(s) flagged. Review them below, then bulk block or delete.`, `اكتمل الفحص — تم تعليم ${one(sp.flagged)} حساب. راجعها بالأسفل ثم احظر أو احذف جماعيًا.`)}</p>}
      {one(sp.error) === 'scan' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Spam scan failed.', 'فشل الفحص.')}</p>}
      {one(sp.error) === 'bulk' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Bulk action failed.', 'فشل الإجراء الجماعي.')}</p>}

      <FilterBar
        fields={[
          { name: 'q', label: tb('Search', 'بحث'), type: 'text', placeholder: tb('Name / email / phone', 'الاسم / البريد / الهاتف') },
          { name: 'status', label: tb('Status', 'الحالة'), type: 'select', options: [
            { value: 'ACTIVE', label: tb('Active', 'نشط') },
            { value: 'UNVERIFIED', label: tb('Unverified', 'غير مؤكد') },
            { value: 'FLAGGED', label: tb('Flagged', 'مُعلَّم') },
            { value: 'BLOCKED', label: tb('Blocked', 'محظور') },
          ] },
          { name: 'seg', label: tb('Segment', 'الشريحة'), type: 'select', options: [
            { value: 'with-orders', label: tb('Has ordered', 'اشترى من قبل') },
            { value: 'no-orders', label: tb('Never ordered', 'لم يشترِ') },
            { value: 'repeat', label: tb('Repeat buyers (2+)', 'مشترون متكررون (٢+)') },
            { value: 'high-value', label: tb('High value', 'قيمة عالية') },
            { value: 'lapsed', label: tb('Lapsed / inactive', 'متوقّف / غير نشط') },
          ] },
          { name: 'tier', label: tb('Tier', 'الفئة'), type: 'select', options: tiers.map((t) => ({ value: t.id, label: t.nameEn })) },
          { name: 'from', label: tb('Joined from', 'انضم من'), type: 'date' },
          { name: 'to', label: tb('Joined to', 'انضم إلى'), type: 'date' },
        ]}
        values={{ q, status, seg, tier, from, to }}
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
              <th className="p-3 text-start">{tb('Name', 'الاسم')}</th>
              <SortableTh col="email" label={tb('Email', 'البريد الإلكتروني')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <SortableTh col="orders" label={tb('Orders', 'الطلبات')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <th className="p-3 text-start">{tb('Last order', 'آخر طلب')}</th>
              <SortableTh col="tier" label={tb('Tier', 'الفئة')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="points" label={tb('Points', 'النقاط')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
              <SortableTh col="spend" label={tb('Total spend', 'إجمالي الإنفاق')} sort={sort} dir={dir} sp={sp} basePath={basePath} />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const key = standingOf(c.status, c.user.emailVerified, c.user.phoneVerified);
              const standingLabel =
                key === 'BLOCKED' ? tb('Blocked', 'محظور')
                : key === 'FLAGGED' ? tb('Flagged', 'مُعلَّم')
                : key === 'UNVERIFIED' ? tb('Unverified', 'غير مؤكد')
                : tb('Active', 'نشط');
              // Nameless accounts show their email handle / phone, not a literal "Profile" (F34).
              const displayName =
                [c.firstName, c.lastName].filter(Boolean).join(' ')
                || c.user.email?.split('@')[0]
                || c.user.phone
                || tb('No name', 'بدون اسم');
              const lastOrder = c.orders[0]?.placedAt;
              return (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3"><input type="checkbox" name="ids" value={c.id} form="bulk-customers" className="size-4" aria-label={c.user.email ?? c.id} /></td>
                <td className="p-3">
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">
                    {displayName}
                  </Link>
                </td>
                <td className="p-3"><Link href={`/admin/customers/${c.id}`} className="hover:underline">{c.user.email}</Link></td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STANDING_CLS[key]}`}>{standingLabel}</span></td>
                <td className="p-3">{c._count.orders > 0 ? <Link href={`/admin/orders?q=${encodeURIComponent(c.user.email ?? '')}`} className="text-primary hover:underline">{c._count.orders}</Link> : 0}</td>
                <td className="p-3 text-muted-foreground">{lastOrder ? new Date(lastOrder).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB') : '—'}</td>
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
              );
            })}
            {customers.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{tb('No customers match.', 'لا يوجد عملاء مطابقون.')}</td></tr>}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
