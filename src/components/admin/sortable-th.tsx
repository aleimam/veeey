import { listQs, type SortDir, type SP } from '@/lib/admin-list';

/**
 * A sortable table header cell. Renders a plain link that toggles asc/desc for
 * its column and resets to page 1, preserving all other list params (filters,
 * search). Server component — no client JS.
 */
export function SortableTh({
  col,
  label,
  sort,
  dir,
  sp,
  basePath,
  align = 'start',
}: {
  col: string;
  label: string;
  sort: string;
  dir: SortDir;
  sp: SP;
  basePath: string;
  align?: 'start' | 'end' | 'center';
}) {
  const active = sort === col;
  const nextDir: SortDir = active && dir === 'asc' ? 'desc' : 'asc';
  const href = `${basePath}${listQs(sp, { sort: col, dir: nextDir, page: undefined })}`;
  const alignCls = align === 'end' ? 'text-end' : align === 'center' ? 'text-center' : 'text-start';
  return (
    <th className={`p-3 ${alignCls}`} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <a href={href} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <span className={active ? 'text-foreground' : 'opacity-30'}>{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </a>
    </th>
  );
}
