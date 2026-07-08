import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listChangeLog, changeLogEntityTypes } from '@/lib/change-log-service';
import { ChangeDetail, ActionBadge, ENTITY_EDIT_URL } from '@/components/admin/change-history';
import { FilterBar } from '@/components/admin/filter-bar';
import { ListPagination } from '@/components/admin/list-pagination';
import { one, type SP } from '@/lib/admin-list';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

const fmtTime = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

/**
 * Global change log (owner batch #6): every entity's created/edited/deleted
 * history with field-level before → after diffs, filterable by entity type,
 * entity id and action. Per-entity panels embed the same data on edit pages.
 */
export default async function ChangeLogPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('settings.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const entityType = one(sp.type);
  const entityId = one(sp.id);
  const action = one(sp.q);
  const from = one(sp.from);
  const to = one(sp.to);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const perPage = 50;

  const [{ entries, total }, types] = await Promise.all([
    listChangeLog({ entityType, entityId, action, from, to, page, perPage }),
    changeLogEntityTypes(),
  ]);

  const basePath = `/${locale}/admin/change-log`;
  const exportQuery = new URLSearchParams(
    Object.entries({ type: entityType, id: entityId, q: action, from, to }).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{tb('Change log', 'سجل التغييرات')} ({total})</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tb(
              'Who changed what, everywhere: field-level before → after diffs for every entity, plus system events.',
              'مَن غيّر ماذا وأين: فروقات قبل → بعد على مستوى الحقول لكل الكيانات، إضافة إلى أحداث النظام.',
            )}
          </p>
        </div>
        <a
          href={`/api/admin/change-log/export${exportQuery ? `?${exportQuery}` : ''}`}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
        >
          {tb('Export CSV', 'تصدير CSV')}
        </a>
      </header>

      <FilterBar
        locale={locale}
        path="change-log"
        values={{ type: entityType, id: entityId, q: action, from, to }}
        fields={[
          { name: 'type', label: tb('Entity', 'الكيان'), type: 'select', options: types.map((t) => ({ value: t, label: t })) },
          { name: 'id', label: tb('Entity id', 'معرّف الكيان'), type: 'text', placeholder: 'cln…' },
          { name: 'q', label: tb('Action', 'الإجراء'), type: 'text', placeholder: tb('e.g. change.update', 'مثال change.update') },
          { name: 'from', label: tb('From', 'من'), type: 'date' },
          { name: 'to', label: tb('To', 'إلى'), type: 'date' },
        ]}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('When (UTC)', 'الوقت (UTC)')}</th>
              <th className="p-3 text-start">{tb('Who', 'مَن')}</th>
              <th className="p-3 text-start">{tb('Action', 'الإجراء')}</th>
              <th className="p-3 text-start">{tb('Entity', 'الكيان')}</th>
              <th className="p-3 text-start">{tb('Details', 'التفاصيل')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const link = e.entityType && e.entityId ? ENTITY_EDIT_URL[e.entityType]?.(e.entityId) : undefined;
              return (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{fmtTime(e.createdAt)}</td>
                  <td className="p-3 text-xs">
                    {e.actorLabel}
                    {e.actorType !== 'USER' && <span className="ms-1 text-muted-foreground">({e.actorType})</span>}
                  </td>
                  <td className="p-3"><ActionBadge action={e.action} /></td>
                  <td className="p-3 text-xs">
                    {e.entityType ?? '—'}
                    {e.entityId && (
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {link ? <Link href={link} className="text-primary hover:underline">{e.entityId}</Link> : e.entityId}
                      </span>
                    )}
                  </td>
                  <td className="max-w-[420px] p-3"><ChangeDetail entry={e} locale={locale} /></td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tb('No log entries match.', 'لا توجد سجلات مطابقة.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ListPagination page={page} perPage={perPage} total={total} sp={sp} basePath={basePath} locale={locale} />
    </div>
  );
}
