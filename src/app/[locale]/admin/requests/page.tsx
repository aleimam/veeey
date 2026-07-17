import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listRequests, countRequests, requestTabCounts } from '@/lib/request-service';
import { requestTypeLabel, requestStatusLabel, REQUEST_STATUS_OPTIONS } from '@/lib/request-i18n';
import { REQUEST_TYPES, isRequestType } from '@/lib/request-logic';
import { StatusBadge, inputCls } from '@/components/admin/ui';
import { ListPagination } from '@/components/admin/list-pagination';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';
import type { SP } from '@/lib/admin-list';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const PER_PAGE = 50;

export default async function RequestsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (the sidebar only hides the link).
  await requirePermission('requests.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const type = isRequestType(one(sp.type) ?? '') ? one(sp.type) : undefined;
  const status = REQUEST_STATUS_OPTIONS.includes((one(sp.status) ?? '') as never) ? one(sp.status) : undefined;
  const q = one(sp.q)?.trim() || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const opts = { type, status, q, page, perPage: PER_PAGE };

  const [rows, total, tabCounts] = await Promise.all([
    listRequests(opts),
    countRequests(opts),
    requestTabCounts(),
  ]);

  const basePath = `/${locale}/admin/requests`;
  // Preserve status + q when switching type tabs; drop page.
  const qsWith = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { type: type ?? '', status: status ?? '', q: q ?? '', ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const allCount = Object.values(tabCounts).reduce((a, b) => a + b, 0);
  const tabCls = (on: boolean) => `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${on ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{tb('Requests', 'الطلبات')} ({total})</h1>
        <Link href="/admin/requests/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          + {tb('New request', 'طلب جديد')}
        </Link>
      </div>

      {/* Type tabs (purchasing priority order) with live counts. */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        <Link href={qsWith({ type: '' })} className={tabCls(!type)}>{tb('All', 'الكل')} ({allCount})</Link>
        {REQUEST_TYPES.map((ty) => (
          <Link key={ty} href={qsWith({ type: ty })} className={tabCls(type === ty)}>
            {requestTypeLabel(tb, ty)} ({tabCounts[ty] ?? 0})
          </Link>
        ))}
      </div>

      {/* Status filter + search (GET form → shareable URL). */}
      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        {type && <input type="hidden" name="type" value={type} />}
        <label className="text-xs font-medium">
          {tb('Status', 'الحالة')}
          <select name="status" defaultValue={status ?? ''} className={`${inputCls} w-40`}>
            <option value="">{tb('All', 'الكل')}</option>
            {REQUEST_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{requestStatusLabel(tb, s)}</option>)}
          </select>
        </label>
        <label className="flex-1 text-xs font-medium">
          {tb('Search', 'بحث')}
          <input name="q" defaultValue={q ?? ''} placeholder={tb('Request no., customer or product…', 'رقم الطلب أو العميل أو المنتج…')} className={inputCls} />
        </label>
        <button className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">{tb('Filter', 'تصفية')}</button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Request', 'الطلب')}</th>
              <th className="p-3 text-start">{tb('Type', 'النوع')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3 text-start">{tb('Customer', 'العميل')}</th>
              <th className="p-3 text-start">{tb('Items', 'العناصر')}</th>
              <th className="p-3 text-start">{tb('Requested by', 'بواسطة')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">
                  <Link href={`/admin/requests/${r.id}`} className="font-mono font-medium text-primary hover:underline">{r.uid ?? r.id.slice(0, 8)}</Link>
                  <div className="text-xs text-muted-foreground">{r.createdAt.toISOString().slice(0, 10)}</div>
                </td>
                <td className="p-3">{requestTypeLabel(tb, r.type)}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3">{r.customer ? `${r.customer.firstName ?? ''} ${r.customer.lastName ?? ''}`.trim() || '—' : '—'}</td>
                <td className="p-3">
                  {r._count.lines} {tb('line(s)', 'سطر')}
                  <div className="max-w-[16rem] truncate text-xs text-muted-foreground">{r.lines.map((l) => `${l.count}× ${l.product.nameEn}`).join(', ')}</div>
                </td>
                <td className="p-3 text-muted-foreground">{r.requestedByName ?? '—'}</td>
                <td className="p-3 text-end"><Link href={`/admin/requests/${r.id}`} className="text-primary hover:underline">{tb('Open', 'فتح')}</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{tb('No requests match this filter.', 'لا توجد طلبات مطابقة لهذه التصفية.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <ListPagination page={page} perPage={PER_PAGE} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
