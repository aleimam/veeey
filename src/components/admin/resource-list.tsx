import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { SortableTh } from '@/components/admin/sortable-th';
import { ListPagination } from '@/components/admin/list-pagination';
import { BulkBar, type BulkOp } from '@/components/admin/bulk-bar';
import type { SortDir, SP } from '@/lib/admin-list';

export type HeadCell = string | { label: string; col?: string };

type BulkConfig = {
  formId: string;
  action: (fd: FormData) => void | Promise<void>;
  locale: string;
  back: string;
  ops: BulkOp[];
  hidden?: Record<string, string>;
  exportHref?: string;
};
type SortCtx = { sort: string; dir: SortDir; sp: SP; basePath: string };
type PageCtx = { page: number; perPage: number; total: number; sp: SP; basePath: string; locale: string };

export async function AdminList({
  title,
  newHref,
  newLabel,
  head,
  rows,
  editLabel,
  notice,
  toolbar,
  count,
  sortCtx,
  bulk,
  pagination,
  emptyState,
}: {
  title: string;
  newHref: string;
  newLabel?: string;
  head: HeadCell[];
  rows: { key: string; cells: React.ReactNode[]; editHref: string; actions?: React.ReactNode }[];
  editLabel?: string;
  notice?: React.ReactNode;
  toolbar?: React.ReactNode;
  count?: number;
  sortCtx?: SortCtx;
  bulk?: BulkConfig;
  pagination?: PageCtx;
  emptyState?: React.ReactNode;
}) {
  const t = await getTranslations('admin.common');
  const colSpan = head.length + 1 + (bulk ? 1 : 0);
  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">
          {title} ({count ?? rows.length})
        </h1>
        <div className="flex items-center gap-3">
          {toolbar}
          <Link href={newHref} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {newLabel ?? t('new')}
          </Link>
        </div>
      </header>
      {notice}
      {bulk && (() => {
        const tb = pick(bulk.locale);
        return (
          <BulkBar
            formId={bulk.formId}
            action={bulk.action}
            locale={bulk.locale}
            back={bulk.back}
            ops={bulk.ops}
            hidden={bulk.hidden}
            exportHref={bulk.exportHref}
            labels={{
              selectAllPage: tb('Select page', 'تحديد الصفحة'),
              selected: tb('selected', 'محدد'),
              apply: tb('Apply', 'تطبيق'),
              exportSel: tb('Export selected', 'تصدير المحدد'),
              confirmDanger: tb('Apply to the selected rows? Deletes skip records still in use.', 'تطبيق على الصفوف المحددة؟ يتخطّى الحذف السجلات المستخدمة.'),
              needValue: tb('Choose a value first.', 'اختر قيمة أولًا.'),
            }}
          />
        );
      })()}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              {bulk && <th className="w-8 p-3" />}
              {head.map((h, i) =>
                typeof h !== 'string' && h.col && sortCtx ? (
                  <SortableTh key={i} col={h.col} label={h.label} sort={sortCtx.sort} dir={sortCtx.dir} sp={sortCtx.sp} basePath={sortCtx.basePath} />
                ) : (
                  <th key={i} className="p-3 text-start">{typeof h === 'string' ? h : h.label}</th>
                ),
              )}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                {bulk && <td className="p-3"><input type="checkbox" name="ids" value={r.key} form={bulk.formId} className="size-4" /></td>}
                {r.cells.map((c, i) => <td key={i} className="p-3">{c}</td>)}
                <td className="p-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={r.editHref} className="text-primary hover:underline">{editLabel ?? t('edit')}</Link>
                    {r.actions}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={colSpan} className="p-6 text-center text-muted-foreground">{emptyState ?? 'Nothing here yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pagination && <ListPagination page={pagination.page} perPage={pagination.perPage} total={pagination.total} sp={pagination.sp} basePath={pagination.basePath} locale={pagination.locale} />}
    </div>
  );
}
