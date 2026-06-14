import { Link } from '@/i18n/navigation';

export function AdminList({
  title,
  newHref,
  newLabel = 'New',
  head,
  rows,
}: {
  title: string;
  newHref: string;
  newLabel?: string;
  head: string[];
  rows: { key: string; cells: React.ReactNode[]; editHref: string }[];
}) {
  return (
    <div className="p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">
          {title} ({rows.length})
        </h1>
        <Link href={newHref} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          {newLabel}
        </Link>
      </header>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              {head.map((h) => <th key={h} className="p-3 text-start">{h}</th>)}
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                {r.cells.map((c, i) => <td key={i} className="p-3">{c}</td>)}
                <td className="p-3 text-end">
                  <Link href={r.editHref} className="text-primary hover:underline">Edit</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={head.length + 1} className="p-6 text-center text-muted-foreground">Nothing here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
