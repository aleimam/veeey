import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { pick } from '@/lib/admin-i18n';
import { findCyrillicJunk } from '@/lib/admin-cleanup-service';
import { deleteCyrillicJunkAction } from '@/server/cleanup-actions';
import { SubmitButton } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CleanupPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale });
  if (!user) return null;
  if (!hasPermission(user.permissions, 'settings.manage')) redirect({ href: '/admin', locale });

  const junk = await findCyrillicJunk();
  const totalDeletable = junk.customers.deletable + junk.products.total + junk.reviews.total;

  const card = 'rounded-xl border border-border bg-card p-5';
  const ran = one(sp.rev) != null;

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-2 font-heading text-xl font-semibold text-foreground">{tb('Cleanup junk (Russian / Cyrillic)', 'تنظيف غير المرغوب (الروسي / السيريلي)')}</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        {tb(
          'Finds and removes spam records whose names/content contain Cyrillic characters — left over from the import. Preview below shows exactly what will be deleted. Customers with real orders are always kept; products still on an order are skipped.',
          'يبحث ويحذف السجلات غير المرغوبة التي تحتوي أسماؤها/محتواها على أحرف سيريلية — من بقايا الاستيراد. تعرض المعاينة بالأسفل ما سيُحذف بالضبط. يُحتفظ دائمًا بالعملاء الذين لديهم طلبات، وتُتخطّى المنتجات المرتبطة بطلب.',
        )}
      </p>

      {one(sp.error) && <div className="mb-5 max-w-2xl rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Cleanup failed.', 'فشل التنظيف.')}</div>}
      {ran && (
        <div className="mb-5 max-w-2xl rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {tb(
            `Deleted ${one(sp.rev)} reviews, ${one(sp.cust)} customers, ${one(sp.prod)} products.` + (Number(one(sp.custKept)) > 0 ? ` Kept ${one(sp.custKept)} customers (had orders / linked data).` : '') + (one(sp.done) === '0' ? ' More remain — click again to continue.' : ''),
            `تم حذف ${one(sp.rev)} مراجعة و${one(sp.cust)} عميل و${one(sp.prod)} منتج.` + (Number(one(sp.custKept)) > 0 ? ` تم الإبقاء على ${one(sp.custKept)} عميل (لديهم طلبات/بيانات مرتبطة).` : '') + (one(sp.done) === '0' ? ' لا يزال هناك المزيد — اضغط مجددًا للمتابعة.' : ''),
          )}
        </div>
      )}

      <div className="grid max-w-2xl gap-4">
        <section className={card}>
          <h2 className="mb-3 text-base font-semibold text-foreground">{tb('Preview — what matches now', 'معاينة — ما يطابق الآن')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={tb('Customers', 'العملاء')} value={junk.customers.total} sub={tb(`${junk.customers.deletable} deletable · ${junk.customers.withOrders} kept`, `${junk.customers.deletable} قابل للحذف · ${junk.customers.withOrders} محفوظ`)} />
            <Stat label={tb('Products', 'المنتجات')} value={junk.products.total} sub="" />
            <Stat label={tb('Reviews', 'المراجعات')} value={junk.reviews.total} sub="" />
          </div>
          <Samples title={tb('Sample customers', 'أمثلة عملاء')} items={junk.customers.samples} />
          <Samples title={tb('Sample products', 'أمثلة منتجات')} items={junk.products.samples} />
          <Samples title={tb('Sample reviews', 'أمثلة مراجعات')} items={junk.reviews.samples} />
        </section>

        {totalDeletable > 0 ? (
          <form action={deleteCyrillicJunkAction} className={`${card} border-destructive/40 bg-destructive/5`}>
            <input type="hidden" name="locale" value={locale} />
            <h2 className="mb-1 text-base font-semibold text-destructive">{tb('Delete permanently', 'حذف نهائي')}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{tb(`This permanently removes ${totalDeletable} records (and their reviews/addresses). This cannot be undone. Large batches run in chunks — re-run until the preview reads zero.`, `سيؤدي هذا إلى حذف ${totalDeletable} سجل نهائيًا (ومراجعاتهم/عناوينهم). لا يمكن التراجع. تُنفَّذ الدفعات الكبيرة على مراحل — أعد التشغيل حتى تصل المعاينة إلى صفر.`)}</p>
            <label className="mb-3 flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" required className="size-4" />
              {tb('I understand this permanently deletes the records above.', 'أفهم أن هذا يحذف السجلات أعلاه نهائيًا.')}
            </label>
            <SubmitButton>{tb('Delete junk now', 'احذف غير المرغوب الآن')}</SubmitButton>
          </form>
        ) : (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{tb('No Cyrillic junk found — nothing to delete. 🎉', 'لا يوجد محتوى سيريلي غير مرغوب — لا شيء للحذف. 🎉')}</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="text-sm text-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Samples({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <ul className="mt-1 space-y-0.5 text-xs text-foreground">
        {items.map((s, i) => <li key={i} className="truncate" dir="auto">• {s}</li>)}
      </ul>
    </div>
  );
}
