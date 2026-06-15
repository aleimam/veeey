import { Link } from '@/i18n/navigation';
import { archiveEntityAction, deleteEntityAction } from '@/server/admin-actions';

/** Archive/Restore (+ optional guarded Delete) controls for an admin list row.
 *  Pure server component — renders server-action forms. */
export function RowActions({
  entity,
  id,
  path,
  locale,
  archived,
  canDelete = true,
}: {
  entity: string;
  id: string;
  path: string;
  locale: string;
  archived: boolean;
  canDelete?: boolean;
}) {
  return (
    <>
      <form action={archiveEntityAction}>
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="archived" value={archived ? '0' : '1'} />
        <button className="text-muted-foreground hover:text-foreground">{archived ? 'Restore' : 'Archive'}</button>
      </form>
      {canDelete && (
        <form action={deleteEntityAction}>
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="locale" value={locale} />
          <button className="text-destructive hover:underline">Delete</button>
        </form>
      )}
    </>
  );
}

/** Toolbar link to flip between active and archived views of a list. */
export function ArchivedToggle({ path, showingArchived }: { path: string; showingArchived: boolean }) {
  return (
    <Link
      href={showingArchived ? `/admin/${path}` : `/admin/${path}?archived=1`}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
    >
      {showingArchived ? 'View active' : 'View archived'}
    </Link>
  );
}

/** Banner shown when a hard-delete was refused because the record is in use. */
export function InUseNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      That item is in use and can’t be deleted. Archive it instead — it will be hidden but kept for history.
    </p>
  );
}
