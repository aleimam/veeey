import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { conditionMigrationPlan } from '@/lib/condition-migration-service';
import { applyConditionMigrationAction } from '@/server/inventory-actions';
import { conditionLabel } from '@/lib/lot-condition';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Dry-run + apply for the damaged-goods → Condition migration (V4 C9). */
export default async function ConditionMigrationPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const plan = await conditionMigrationPlan();
  const applied = one(sp.applied);
  const failed = one(sp.error) === '1';

  const th = 'p-3 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'p-3 text-sm align-top';

  return (
    <div className="p-6">
      <Link href="/admin/inventory/lots" className="text-sm text-primary hover:underline">← {tb('Lots', 'الدفعات')}</Link>
      <h1 className="mb-1 mt-2 font-heading text-xl font-semibold">{tb('Damaged-goods condition migration', 'ترحيل حالات التلف إلى حقل الحالة')}</h1>
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'Legacy products encode damage in the NAME (e.g. "{Broken bottle}"). This is a DRY RUN: review the mapping below, then Apply — each matched variant\'s lots move to the base product with the proper packaging Condition, and the variant is archived (never deleted; order history stays intact).',
          'المنتجات القديمة تُرمّز التلف في الاسم (مثل "{Broken bottle}"). هذه معاينة تجريبية: راجع الجدول ثم طبّق — تنتقل تشغيلات كل نسخة مطابقة إلى المنتج الأساسي مع ضبط «حالة العبوة»، وتُؤرشف النسخة (لا تُحذف؛ سجل الطلبات يبقى سليمًا).',
        )}
      </p>

      {applied != null && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb(`Applied — ${applied} product(s), ${one(sp.lots) ?? 0} lot(s) moved.`, `تم التطبيق — ${applied} منتج، ${one(sp.lots) ?? 0} تشغيلة.`)}</p>}
      {failed && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Apply failed — check the server logs.', 'فشل التطبيق — راجع سجلات الخادم.')}</p>}

      <h2 className="mb-2 text-sm font-semibold text-foreground">{tb('Will migrate', 'سيُرحَّل')} ({plan.matched.length})</h2>
      <div className="mb-6 overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className={th}>{tb('Variant product', 'المنتج النسخة')}</th>
            <th className={th}>{tb('Condition', 'حالة العبوة')}</th>
            <th className={th}>{tb('Lots / units', 'التشغيلات / الوحدات')}</th>
            <th className={th}>{tb('→ Base product', '← المنتج الأساسي')}</th>
          </tr></thead>
          <tbody>
            {plan.matched.map((r) => (
              <tr key={r.variantId} className="border-t border-border">
                <td className={td}><div className="font-medium">{r.variantName}</div><div className="font-mono text-xs text-muted-foreground">{r.variantSku} · {r.variantStatus}</div></td>
                <td className={td}><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{conditionLabel(r.condition, locale)}</span></td>
                <td className={td}>{r.lots} / {r.units}</td>
                <td className={td}><div className="font-medium">{r.baseName}</div><div className="font-mono text-xs text-muted-foreground">{r.baseSku}</div></td>
              </tr>
            ))}
            {plan.matched.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">{tb('Nothing to migrate — no marker-named products with a matching base found.', 'لا شيء للترحيل — لا توجد منتجات بأسماء موسومة لها أساس مطابق.')}</td></tr>}
          </tbody>
        </table>
      </div>

      {plan.matched.length > 0 && (
        <form action={applyConditionMigrationAction} className="mb-8">
          <input type="hidden" name="locale" value={locale} />
          <ConfirmButton
            warn={tb(`Move the lots of ${plan.matched.length} variant product(s) onto their base products and archive the variants?`, `نقل تشغيلات ${plan.matched.length} منتجًا إلى منتجاتها الأساسية وأرشفة النسخ؟`)}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {tb('Apply migration', 'تطبيق الترحيل')}
          </ConfirmButton>
        </form>
      )}

      <h2 className="mb-2 text-sm font-semibold text-foreground">{tb('Needs manual review (no matching base)', 'يحتاج مراجعة يدوية (لا أساس مطابق)')} ({plan.unmatched.length})</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead className="bg-surface"><tr>
            <th className={th}>{tb('Variant product', 'المنتج النسخة')}</th>
            <th className={th}>{tb('Condition', 'حالة العبوة')}</th>
            <th className={th}>{tb('Lots / units', 'التشغيلات / الوحدات')}</th>
            <th className={th} />
          </tr></thead>
          <tbody>
            {plan.unmatched.map((r) => (
              <tr key={r.variantId} className="border-t border-border">
                <td className={td}><div className="font-medium">{r.variantName}</div><div className="font-mono text-xs text-muted-foreground">{r.variantSku}</div></td>
                <td className={td}>{conditionLabel(r.condition, locale)}</td>
                <td className={td}>{r.lots} / {r.units}</td>
                <td className={`${td} text-end`}><Link href={`/admin/products/edit/${r.variantId}`} className="text-sm text-primary hover:underline">{tb('Open product', 'فتح المنتج')}</Link></td>
              </tr>
            ))}
            {plan.unmatched.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">{tb('None 🎉', 'لا شيء 🎉')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
