import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getTier } from '@/lib/tier-service';
import { listCategories, listTags, listAttributes } from '@/lib/taxonomy-service';
import { TierForm } from '@/components/admin/tier-form';
import { addTierRuleAction, deleteTierRuleAction } from '@/server/tier-actions';
import { inputCls } from '@/components/admin/ui';

export default async function TierEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tierId = id?.[0];
  const tier = tierId ? await getTier(tierId) : null;

  // Match options for rule targeting (categories, tags, attribute values).
  const [cats, tags, attrs] = await Promise.all([listCategories(), listTags(), listAttributes()]);
  const catOpts = cats.filter((c) => !c.archivedAt).map((c) => ({ value: `CATEGORY:${c.id}`, label: c.nameEn }));
  const tagOpts = tags.filter((t) => !t.archivedAt).map((t) => ({ value: `TAG:${t.id}`, label: t.nameEn }));
  const attrOpts = attrs
    .filter((a) => !a.archivedAt)
    .flatMap((a) => a.values.map((v) => ({ value: `ATTRIBUTE:${v.id}`, label: `${a.nameEn}: ${v.valueEn}` })));
  const labelFor = new Map<string, string>([...catOpts, ...tagOpts, ...attrOpts].map((o) => [o.value, o.label]));

  return (
    <div className="p-6">
      <Link href="/admin/tiers" className="text-sm text-primary hover:underline">← الفئات</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{tierId ? 'تعديل الفئة' : 'فئة جديدة'}</h1>

      <TierForm
        id={tierId}
        locale={locale}
        defaults={tier ? {
          key: tier.key, nameEn: tier.nameEn, nameAr: tier.nameAr, rank: tier.rank,
          earnRatePerEgp: tier.earnRatePerEgp, color: tier.color, badge: tier.badge,
        } : {}}
      />

      {tier && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-3 font-heading text-lg font-semibold">قواعد المنتجات لكل فئة</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            تعدّل القواعد السعر أو الظهور أو التوفر للمنتجات المطابقة لفئة أو وسم أو قيمة خاصية — لأعضاء {tier.nameEn} فقط.
          </p>

          <div className="mb-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-xs uppercase text-muted-foreground">
                <tr><th className="p-3 text-start">المطابقة</th><th className="p-3 text-start">التأثير</th><th className="p-3 text-start">التفاصيل</th><th className="p-3" /></tr>
              </thead>
              <tbody>
                {tier.rules.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3">{labelFor.get(`${r.matchType}:${r.matchValue}`) ?? `${r.matchType}: ${r.matchValue}`}</td>
                    <td className="p-3">{r.effect}</td>
                    <td className="p-3 text-muted-foreground">
                      {r.effect === 'PRICE'
                        ? `${r.priceModifierType === 'PERCENT' ? `خصم ${r.priceModifierValue}%` : `خصم ${r.priceModifierValue} ج.م`}`
                        : r.effect === 'VISIBILITY'
                          ? (r.visible ? 'ظاهر' : 'مخفي')
                          : (r.available ? 'متوفر' : 'غير متوفر')}
                    </td>
                    <td className="p-3 text-end">
                      <form action={deleteTierRuleAction}>
                        <input type="hidden" name="ruleId" value={r.id} />
                        <input type="hidden" name="tierId" value={tier.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <button className="text-destructive hover:underline">إزالة</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {tier.rules.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا توجد قواعد بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <form action={addTierRuleAction} className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm font-semibold">إضافة قاعدة</p>
            <input type="hidden" name="tierId" value={tier.id} />
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">المطابقة
                <select name="match" required className={inputCls}>
                  <optgroup label="الفئات">
                    {catOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                  <optgroup label="الوسوم">
                    {tagOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                  <optgroup label="قيم الخصائص">
                    {attrOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </optgroup>
                </select>
              </label>
              <label className="block text-sm font-medium">التأثير
                <select name="effect" className={inputCls} defaultValue="PRICE">
                  <option value="PRICE">السعر</option>
                  <option value="VISIBILITY">الظهور</option>
                  <option value="AVAILABILITY">التوفر</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">معدّل السعر <span className="font-normal text-muted-foreground">(إذا كان التأثير = السعر)</span>
                <select name="priceModifierType" className={inputCls} defaultValue="PERCENT">
                  <option value="PERCENT">خصم نسبة (%)</option>
                  <option value="FIXED">خصم مبلغ ثابت (ج.م)</option>
                </select>
              </label>
              <label className="block text-sm font-medium">المبلغ
                <input name="priceModifierValue" type="number" min={0} defaultValue={0} className={inputCls} />
              </label>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="visible" defaultChecked /> ظاهر <span className="text-muted-foreground">(تأثير الظهور)</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" name="available" defaultChecked /> متوفر <span className="text-muted-foreground">(تأثير التوفر)</span></label>
            </div>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">إضافة قاعدة</button>
          </form>
        </section>
      )}
    </div>
  );
}
