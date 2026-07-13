import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { listVariantGroups } from '@/lib/variant-service';
import { deleteVariantGroupAction } from '@/server/variant-actions';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
type SP = Record<string, string | string[] | undefined>;

export default async function VariantGroupsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  await requirePermission('catalog.write');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const groups = await listVariantGroups();
  const flag = one(sp.saved) ? 'saved' : one(sp.deleted) ? 'deleted' : one(sp.error);
  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm';

  return (
    <div className="max-w-4xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Variant groups', 'مجموعات المتغيرات')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {tb(
              'Link sibling products (sizes, counts, flavors…) into one family. Shoppers get a selector on the product page, and the whole family shares its reviews. Each product keeps its own SKU, stock lots, and price-per-expiry.',
              'اربط المنتجات الشقيقة (أحجام، عبوات، نكهات…) في عائلة واحدة. يحصل المتسوّقون على مُحدِّد في صفحة المنتج وتتشارك العائلة مراجعاتها. يحتفظ كل منتج بـ SKU ومخزونه وسعره حسب الصلاحية.',
            )}
          </p>
        </div>
        <Link href="/admin/variant-groups/edit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium leading-9 text-primary-foreground hover:opacity-90">{tb('New group', 'مجموعة جديدة')}</Link>
      </div>

      {flag === 'saved' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Group saved.', 'تم حفظ المجموعة.')}</div>}
      {flag === 'deleted' && <div className="mb-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Group deleted (products kept, just unlinked).', 'حُذفت المجموعة (بقيت المنتجات، أُلغي الربط فقط).')}</div>}
      {flag === 'forbidden' && <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb("You don't have permission.", 'ليس لديك صلاحية.')}</div>}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] border-collapse">
          <thead className="bg-surface">
            <tr><th className={th}>{tb('Name', 'الاسم')}</th><th className={th}>{tb('Axes', 'المحاور')}</th><th className={`${th} text-end`}>{tb('Products', 'المنتجات')}</th><th className={`${th} text-end`}></th></tr>
          </thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">{tb('No variant groups yet — create the first one.', 'لا مجموعات متغيرات بعد — أنشئ الأولى.')}</td></tr>}
            {groups.map((g) => (
              <tr key={g.id} className="border-t border-border">
                <td className={`${td} font-medium text-foreground`}><Link href={`/admin/variant-groups/edit/${g.id}`} className="text-primary hover:underline">{g.name}</Link></td>
                <td className={`${td} text-muted-foreground`}>{g.axes.map((a) => a.nameEn).join(' · ') || '—'}</td>
                <td className={`${td} text-end tabular-nums`}>{g.memberCount}</td>
                <td className={`${td} text-end`}>
                  <form action={deleteVariantGroupAction} className="inline">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={g.id} />
                    <button type="submit" className="h-8 rounded-md border border-border px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10">{tb('Delete', 'حذف')}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
