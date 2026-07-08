import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { loadRestructurePlan } from '@/lib/taxonomy-restructure-service';
import { ApplyRestructureButton } from '@/components/admin/apply-restructure-button';
import { pick } from '@/lib/admin-i18n';
import type { SP } from '@/lib/admin-list';

export const dynamic = 'force-dynamic';
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Taxonomy restructure DRY-RUN (V2 CAT-4): the complete proposed mapping onto
 *  the approved 4-parent tree, reviewed here before the one-click Apply. */
export default async function RestructurePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const plan = await loadRestructurePlan();
  const applied = one(sp.applied);
  const nodeName = (key: string) => plan.nodes.find((n) => n.key === key)?.name ?? key;

  const touching = plan.assign.length + plan.create.length + plan.merge.length + plan.adopt.length;
  const card = 'rounded-xl border border-border bg-card p-4';
  const h = 'mb-2 text-sm font-semibold text-foreground';
  const tbl = 'w-full text-sm';
  const thd = 'bg-surface text-start text-xs uppercase text-muted-foreground';

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Category restructure — dry run', 'إعادة هيكلة الفئات — معاينة')}</h1>
          <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
            {tb('Proposed mapping onto the approved 4-parent tree. Nothing changes until you press Apply: primaries are renamed/re-slugged in place, duplicates merge (products move, source archived), slug changes get redirects, and unmatched categories are left for manual review.', 'الخطة المقترحة على الشجرة المعتمدة بأربعة أقسام رئيسية. لا يتغير شيء قبل الضغط على «تطبيق»: الفئات الأساسية تُعاد تسميتها، والتكرارات تُدمج (تنتقل المنتجات وتُأرشف النسخة)، وتغييرات الروابط تحصل على تحويلات، وغير المطابق يُترك للمراجعة اليدوية.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/categories" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">← {tb('Categories', 'الفئات')}</Link>
          <ApplyRestructureButton locale={locale} touching={touching} />
        </div>
      </header>

      {applied && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Applied ✓ (${applied}) — review the tree on the Categories page; the full snapshot is in the change log.`, `تم التطبيق ✓ (${applied}) — راجع الشجرة في صفحة الفئات؛ اللقطة الكاملة في سجل التغييرات.`)}</p>}
      {one(sp.error) && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Apply failed — nothing may be partially changed; check the server logs and the change log before retrying.', 'فشل التطبيق — تحقق من سجلات الخادم وسجل التغييرات قبل الإعادة.')}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {[
          [plan.assign.length, tb('Mapped in place', 'مطابَقة')],
          [plan.create.length, tb('Will be created', 'ستُنشأ')],
          [plan.merge.length, tb('Merges', 'دمج')],
          [plan.merge.reduce((n, m) => n + m.products, 0), tb('Products moved', 'منتجات ستنتقل')],
          [plan.adopt.length, tb('Adopted', 'تُتبنى')],
          [plan.unmatched.length, tb('Unmatched (manual)', 'غير مطابقة (يدوي)')],
        ].map(([v, l]) => (
          <div key={String(l)} className={`${card} text-center`}><p className="text-2xl font-bold text-foreground">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
        ))}
      </div>

      <section className={card}>
        <h2 className={h}>{tb('Target tree', 'الشجرة المستهدفة')}</h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {plan.nodes.filter((n) => n.depth === 0).map((root) => (
            <div key={root.key}>
              <p className="font-semibold text-foreground">{root.name}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {plan.nodes.filter((n) => n.parentKey === root.key).map((c) => (
                  <li key={c.key}>
                    {c.name}
                    {plan.nodes.some((g) => g.parentKey === c.key) && (
                      <span className="text-xs"> — {plan.nodes.filter((g) => g.parentKey === c.key).map((g) => g.name).join(', ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {plan.assign.length > 0 && (
        <section className={card}>
          <h2 className={h}>{tb('Mapped in place (renamed / re-slugged / re-parented)', 'مطابَقة (إعادة تسمية / رابط / أب)')}</h2>
          <div className="overflow-x-auto"><table className={tbl}>
            <thead className={thd}><tr><th className="p-2 text-start">{tb('Existing', 'الحالية')}</th><th className="p-2 text-start">{tb('Becomes', 'تصبح')}</th><th className="p-2 text-start">{tb('Changes', 'التغييرات')}</th><th className="p-2 text-center">{tb('Products', 'المنتجات')}</th></tr></thead>
            <tbody>{plan.assign.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-2">{a.oldName} <span className="font-mono text-xs text-muted-foreground">/{a.oldSlug}</span></td>
                <td className="p-2 font-medium">{nodeName(a.nodeKey)}</td>
                <td className="p-2 text-xs text-muted-foreground">{[a.rename && tb('rename', 'تسمية'), a.reslug && tb('slug + redirect', 'رابط + تحويل')].filter(Boolean).join(' · ') || '—'}</td>
                <td className="p-2 text-center">{a.products}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {plan.merge.length > 0 && (
        <section className={card}>
          <h2 className={h}>{tb('Merges (products move, source ARCHIVED)', 'الدمج (تنتقل المنتجات وتُأرشف النسخة)')}</h2>
          <div className="overflow-x-auto"><table className={tbl}>
            <thead className={thd}><tr><th className="p-2 text-start">{tb('Duplicate', 'المكررة')}</th><th className="p-2 text-start">{tb('Merges into', 'تُدمج في')}</th><th className="p-2 text-center">{tb('Products', 'المنتجات')}</th><th className="p-2 text-start">{tb('Note', 'ملاحظة')}</th></tr></thead>
            <tbody>{plan.merge.map((m) => (
              <tr key={m.fromId} className="border-t border-border">
                <td className="p-2">{m.fromName}</td>
                <td className="p-2 font-medium">{nodeName(m.intoKey)}</td>
                <td className="p-2 text-center">{m.products}</td>
                <td className="p-2 text-xs text-muted-foreground">{m.keepAsNameAr ? tb('Arabic label kept as the Arabic name', 'يُحفظ الاسم العربي في حقل الاسم العربي') : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      {plan.adopt.length > 0 && (
        <section className={card}>
          <h2 className={h}>{tb('Adopted (kept, re-parented under the mapped parent)', 'المتبنّاة (تبقى وتُنقل تحت الأب المناسب)')}</h2>
          <ul className="space-y-1 text-sm">
            {plan.adopt.map((a) => (
              <li key={a.id}>{a.name} → <span className="font-medium">{nodeName(a.underKey)}</span>{a.fixSlug && <span className="ms-2 font-mono text-xs text-muted-foreground">/{a.oldSlug} → /{a.fixSlug}</span>} <span className="text-xs text-muted-foreground">({a.products} {tb('products', 'منتج')})</span></li>
            ))}
          </ul>
        </section>
      )}

      {plan.redirects.length > 0 && (
        <section className={card}>
          <h2 className={h}>{tb(`Slug redirects (${plan.redirects.length})`, `تحويلات الروابط (${plan.redirects.length})`)}</h2>
          <ul className="max-h-48 space-y-0.5 overflow-auto font-mono text-xs text-muted-foreground">
            {plan.redirects.map((r) => <li key={r.from}>{r.from} → {r.to}</li>)}
          </ul>
        </section>
      )}

      {plan.unmatched.length > 0 && (
        <section className={`${card} border-amber-300`}>
          <h2 className={h}>⚠ {tb('Unmatched — NOT touched by Apply; assign parents manually afterwards', 'غير مطابقة — لن يمسّها التطبيق؛ عيّن الأب يدويًا بعده')}</h2>
          <ul className="space-y-1 text-sm">
            {plan.unmatched.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/categories/edit/${u.id}`} className="text-primary hover:underline">{u.name}</Link>
                <span className="ms-2 text-xs text-muted-foreground">({u.products} {tb('products', 'منتج')}{u.isArabic ? tb(', Arabic-named', '، اسم عربي') : ''})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
