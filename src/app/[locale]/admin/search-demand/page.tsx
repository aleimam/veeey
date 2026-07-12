import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { unstockedDemand } from '@/lib/search-analytics';

export const dynamic = 'force-dynamic';
const RANGES = [30, 90, 180] as const;
const num = (n: number, locale: string) => n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US');

export default async function SearchDemandPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  await requirePermission('inventory.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const days = RANGES.includes(Number(sp.days) as (typeof RANGES)[number]) ? Number(sp.days) : 30;
  const ar = locale === 'ar';

  const d = await unstockedDemand(days);
  const th = 'px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const td = 'px-3 py-2 text-sm';

  return (
    <div className="max-w-5xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/analytics/search" className="text-sm text-primary hover:underline">← {tb('Search analytics', 'تحليلات البحث')}</Link>
          <h1 className="mt-1 font-heading text-xl font-semibold text-foreground">{tb('Unstocked demand', 'الطلب غير المتوفر')}</h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <Link key={r} href={`/admin/search-demand?days=${r}`} className={`rounded-md px-3 py-1 text-sm ${r === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface'}`}>
              {tb(`${r}d`, `${r} يوم`)}
            </Link>
          ))}
        </div>
      </div>
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'What shoppers are searching for that they cannot buy right now — products they clicked but that are out of stock, and searches that returned nothing. Use it to prioritise restocking and sourcing.',
          'ما يبحث عنه المتسوّقون ولا يمكنهم شراؤه الآن — منتجات نقروا عليها لكنها غير متوفرة، وعمليات بحث لم تُرجع شيئًا. استخدمه لترتيب أولويات إعادة التخزين والتوريد.',
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Clicked but out of stock', 'نُقر عليه لكنه غير متوفر')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface"><tr><th className={th}>{tb('Product', 'المنتج')}</th><th className={`${th} text-end`}>{tb('Clicks', 'نقرات')}</th><th className={`${th} text-end`}>{tb('Status', 'الحالة')}</th></tr></thead>
              <tbody>
                {d.outOfStock.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('Nothing clicked is out of stock. 🎉', 'لا شيء مطلوب غير متوفر. 🎉')}</td></tr>}
                {d.outOfStock.map((p) => (
                  <tr key={p.productId} className="border-t border-border">
                    <td className={td}><Link href={`/admin/products/edit/${p.productId}`} className="text-primary hover:underline">{ar ? (p.nameAr ?? p.nameEn) : p.nameEn}</Link></td>
                    <td className={`${td} text-end tabular-nums`}>{num(p.clicks, locale)}</td>
                    <td className={`${td} text-end`}>
                      {p.preorder
                        ? <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{tb('Pre-order', 'طلب مسبق')}</span>
                        : <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{tb('Out of stock', 'غير متوفر')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tb('Restock these or enable pre-order so the demand converts.', 'أعد تخزينها أو فعّل الطلب المسبق كي يتحوّل الطلب.')}</p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">{tb('Searched, found nothing', 'بُحث عنه ولم يُوجد')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface"><tr><th className={th}>{tb('Term', 'الكلمة')}</th><th className={`${th} text-end`}>{tb('Searches', 'بحث')}</th><th className={`${th} text-end`}>{tb('Action', 'إجراء')}</th></tr></thead>
              <tbody>
                {d.zeroResult.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{tb('No empty searches. 🎉', 'لا عمليات بحث فارغة. 🎉')}</td></tr>}
                {d.zeroResult.map((z) => (
                  <tr key={z.normalized} className="border-t border-border">
                    <td className={`${td} font-medium`}>{z.term}</td>
                    <td className={`${td} text-end tabular-nums`}>{num(z.searches, locale)}</td>
                    <td className={`${td} text-end`}>
                      <Link href={`/admin/search-synonyms?term=${encodeURIComponent(z.normalized)}`} className="text-primary hover:underline">{tb('Alias', 'ربط')}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tb('Alias to an existing product, add it to the catalog, or redirect it from search rules.', 'اربطها بمنتج موجود، أو أضفها للكتالوج، أو أعد توجيهها من قواعد البحث.')}</p>
        </section>
      </div>
    </div>
  );
}
