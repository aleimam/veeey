import { setRequestLocale } from 'next-intl/server';
import { listTiers } from '@/lib/tier-service';
import { AdminList } from '@/components/admin/resource-list';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteTierAction } from '@/server/tier-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TiersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tiers = await listTiers();

  return (
    <AdminList
      title="فئات الولاء"
      newHref="/admin/tiers/edit"
      newLabel="فئة جديدة"
      head={['الرتبة', 'الاسم', 'العربية', 'الكود', 'نقاط / ج.م', 'اللون', 'الأعضاء', 'القواعد']}
      editLabel="تعديل والقواعد"
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={tiers.map((t) => ({
        key: t.id,
        cells: [
          String(t.rank),
          t.nameEn,
          t.nameAr,
          t.key,
          String(t.earnRatePerEgp),
          <span key="c" className="inline-flex items-center gap-2">
            <span className="inline-block size-4 rounded-full border border-border" style={{ backgroundColor: t.color ?? 'transparent' }} />
            {t.color ?? '—'}
          </span>,
          String(t._count.customers),
          String(t._count.rules),
        ],
        editHref: `/admin/tiers/edit/${t.id}`,
        actions: (
          <form action={deleteTierAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">حذف</button>
          </form>
        ),
      }))}
    />
  );
}
