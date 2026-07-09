import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { archiveEntityAction, deleteEntityAction } from '@/server/admin-actions';
import { ConfirmButton } from './confirm-button';

/** Archive/Restore (+ optional guarded Delete) controls for an admin list row.
 *  Async server component — renders server-action forms. With `warn` set (e.g.
 *  "brand has 12 products"), Archive and Delete ask for confirmation first. */
export async function RowActions({
  entity,
  id,
  path,
  locale,
  archived,
  canDelete = true,
  warn,
  label,
}: {
  entity: string;
  id: string;
  path: string;
  locale: string;
  archived: boolean;
  canDelete?: boolean;
  warn?: string;
  /** Item display name — used in the delete confirmation ("Delete '{name}'?"). */
  label?: string;
}) {
  const t = await getTranslations('admin.common');
  const archiveBtn = archived ? t('restore') : t('archive');
  // Destructive Delete always confirms: the in-use `warn` if present, else a
  // generic (named when we have the item's label) confirmation.
  const deleteWarn = warn ?? (label ? t('deleteConfirmNamed', { name: label }) : t('deleteConfirm'));
  return (
    <>
      <form action={archiveEntityAction}>
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="archived" value={archived ? '0' : '1'} />
        {warn && !archived
          ? <ConfirmButton warn={warn} className="text-muted-foreground hover:text-foreground">{archiveBtn}</ConfirmButton>
          : <button className="text-muted-foreground hover:text-foreground">{archiveBtn}</button>}
      </form>
      {canDelete && (
        <form action={deleteEntityAction}>
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="path" value={path} />
          <input type="hidden" name="locale" value={locale} />
          <ConfirmButton warn={deleteWarn} className="text-destructive hover:underline">{t('delete')}</ConfirmButton>
        </form>
      )}
    </>
  );
}

/** Toolbar link to flip between active and archived views of a list. */
export async function ArchivedToggle({ path, showingArchived }: { path: string; showingArchived: boolean }) {
  const t = await getTranslations('admin.common');
  return (
    <Link
      href={showingArchived ? `/admin/${path}` : `/admin/${path}?archived=1`}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface"
    >
      {showingArchived ? t('viewActive') : t('viewArchived')}
    </Link>
  );
}

/** Banner shown when a hard-delete was refused because the record is in use. */
export async function InUseNotice({ show }: { show: boolean }) {
  if (!show) return null;
  const t = await getTranslations('admin.common');
  return (
    <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {t('inUseNotice')}
    </p>
  );
}
