import { setRequestLocale } from 'next-intl/server';
import { listAttributes } from '@/lib/taxonomy-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AttributesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listAttributes();
  const attributes = all.filter((a) => (showingArchived ? a.archivedAt : !a.archivedAt));
  return (
    <AdminList
      title={showingArchived ? 'Attributes (archived)' : 'Attributes'}
      newHref="/admin/attributes/edit"
      newLabel="New attribute"
      head={['Name', 'Key', 'Values']}
      toolbar={<ArchivedToggle path="attributes" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={attributes.map((a) => ({
        key: a.id,
        cells: [a.nameEn, a.key, String(a.values.length)],
        editHref: `/admin/attributes/edit/${a.id}`,
        actions: <RowActions entity="attribute" id={a.id} path="attributes" locale={locale} archived={!!a.archivedAt} />,
      }))}
    />
  );
}
