import { setRequestLocale, getTranslations } from 'next-intl/server';
import { listGifts } from '@/lib/gift-service';
import { AdminList } from '@/components/admin/resource-list';
import { RowActions, ArchivedToggle, InUseNotice } from '@/components/admin/row-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function GiftsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const showingArchived = one(sp.archived) === '1';
  const all = await listGifts();
  const gifts = all.filter((g) => (showingArchived ? g.archivedAt : !g.archivedAt));
  const tf = await getTranslations('admin.fields');
  const tl = await getTranslations('admin.lists');
  const tc = await getTranslations('admin.common');
  return (
    <AdminList
      title={showingArchived ? `${tl('gifts')} ${tc('archivedSuffix')}` : tl('gifts')}
      newHref="/admin/gifts/edit"
      head={[tf('code'), tf('internalName'), tf('stock'), tf('expiry')]}
      toolbar={<ArchivedToggle path="gifts" showingArchived={showingArchived} />}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={gifts.map((g) => ({
        key: g.id,
        cells: [g.code, g.internalName, String(g.stock), g.expiry ? g.expiry.toISOString().slice(0, 10) : '—'],
        editHref: `/admin/gifts/edit/${g.id}`,
        actions: <RowActions entity="gift" id={g.id} path="gifts" locale={locale} archived={!!g.archivedAt} />,
      }))}
    />
  );
}
