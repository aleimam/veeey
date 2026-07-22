import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listCities } from '@/lib/city-service';
import { GOVERNORATES } from '@/lib/governorates';
import { saveCityAction, deleteCityAction } from '@/server/shipping-actions';
import { inputCls } from '@/components/admin/ui';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Delivery districts — what the checkout "City" dropdown offers, per governorate.
 *
 * Filtered to ONE governorate at a time: 396 districts in a flat list is a wall,
 * and every edit here is about one governorate's coverage anyway.
 */
export default async function CitiesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);

  const gov = one(sp.gov) ?? GOVERNORATES[0].en;
  const cities = await listCities(gov);
  const error = one(sp.error);

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link href="/admin/shipping" className="text-sm font-medium text-muted-foreground hover:underline">
          ← {tb('Shipping', 'الشحن')}
        </Link>
        <h1 className="mt-1 font-heading text-xl font-semibold">{tb('Cities & districts', 'المدن والمناطق')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tb(
            'The list customers pick from at checkout, nested under each governorate. Deactivate rather than delete when you stop delivering somewhere — addresses already saved there keep their label.',
            'القائمة التي يختار منها العملاء عند الدفع، مرتبة تحت كل محافظة. عطّل بدل الحذف عند التوقف عن التوصيل لمنطقة — تحتفظ العناوين المحفوظة باسمها.',
          )}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error === 'exists'
            ? tb('A district with that name already exists in this governorate.', 'توجد منطقة بنفس الاسم في هذه المحافظة.')
            : tb('Could not save — check the fields.', 'تعذّر الحفظ — راجع الحقول.')}
        </p>
      )}

      {/* Governorate picker — a GET form so the choice lives in the URL. */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          {tb('Governorate', 'المحافظة')}
          <select name="gov" defaultValue={gov} className={`${inputCls} w-56`}>
            {GOVERNORATES.map((g) => <option key={g.en} value={g.en}>{locale === 'ar' ? g.ar : g.en}</option>)}
          </select>
        </label>
        <button className="h-9 rounded-md border border-border px-4 text-sm font-medium">{tb('Show', 'عرض')}</button>
        <span className="text-sm text-muted-foreground">{tb(`${cities.length} district(s)`, `${cities.length} منطقة`)}</span>
      </form>

      <div className="space-y-2">
        {cities.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {tb('No districts here yet — add the first one below.', 'لا توجد مناطق هنا بعد — أضف الأولى بالأسفل.')}
          </p>
        )}
        {cities.map((c) => (
          <div key={c.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
            <form action={saveCityAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="governorate" value={c.governorate} />
              <label className="text-sm font-medium">{tb('Name (EN)', 'الاسم (EN)')}
                <input name="nameEn" defaultValue={c.nameEn} className={`${inputCls} w-52`} />
              </label>
              <label className="text-sm font-medium">{tb('Name (AR)', 'الاسم (AR)')}
                <input name="nameAr" defaultValue={c.nameAr} dir="rtl" className={`${inputCls} w-52`} />
              </label>
              <label className="text-sm font-medium">{tb('Order', 'الترتيب')}
                <input name="sortOrder" type="number" defaultValue={c.sortOrder} className={`${inputCls} w-20`} />
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm font-medium">
                <input type="checkbox" name="active" defaultChecked={c.active} className="size-4" />
                {tb('Active', 'مفعّل')}
              </label>
              <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{tb('Save', 'حفظ')}</button>
            </form>
            <span className="pb-2 text-xs text-muted-foreground">{c.code}</span>
            {/* Its own form: a nested one is invalid HTML, and Delete must not
                pick up the edit fields next to it. */}
            <form action={deleteCityAction} className="ms-auto">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="governorate" value={c.governorate} />
              <ConfirmButton
                warn={tb(`Delete "${c.nameEn}"? Customers can no longer choose it.`, `حذف "${c.nameEn}"؟ لن يتمكن العملاء من اختيارها.`)}
                className="h-9 rounded-md border border-destructive/40 px-3 text-sm text-destructive"
              >
                {tb('Delete', 'حذف')}
              </ConfirmButton>
            </form>
          </div>
        ))}
      </div>

      <form action={saveCityAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="governorate" value={gov} />
        <h2 className="w-full font-heading text-base font-semibold">
          {tb(`Add a district to ${gov}`, `أضف منطقة إلى ${gov}`)}
        </h2>
        <label className="text-sm font-medium">{tb('Name (EN)', 'الاسم (EN)')}
          <input name="nameEn" required className={`${inputCls} w-52`} />
        </label>
        <label className="text-sm font-medium">{tb('Name (AR)', 'الاسم (AR)')}
          <input name="nameAr" required dir="rtl" className={`${inputCls} w-52`} />
        </label>
        <label className="text-sm font-medium">{tb('Order', 'الترتيب')}
          <input name="sortOrder" type="number" defaultValue={0} className={`${inputCls} w-20`} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm font-medium">
          <input type="checkbox" name="active" defaultChecked className="size-4" />
          {tb('Active', 'مفعّل')}
        </label>
        <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{tb('Add', 'إضافة')}</button>
      </form>
    </div>
  );
}
