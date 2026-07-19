import { setRequestLocale } from 'next-intl/server';
import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { ensureBenefits, listBenefitsMatrix } from '@/lib/tier-benefit-service';
import { toggleTierBenefitAction, createManualBenefitAction, deleteManualBenefitAction } from '@/server/tier-benefit-actions';
import { Check, Minus, Trash2, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Tier benefits matrix (owner 2026-07-19): every member advantage × every tier,
 * toggled here. "System" rows are code-enforced (fees/gates) — rename-only;
 * manual rows are advertised entitlements staff honor — full CRUD.
 */
export default async function TierBenefitsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePermission('pricing.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const ar = locale === 'ar';

  await ensureBenefits();
  const { tiers, benefits } = await listBenefitsMatrix();

  return (
    <div className="max-w-4xl p-6">
      <h1 className="font-heading text-xl font-semibold">{tb('Tier benefits', 'مزايا الفئات')}</h1>
      <p className="mb-4 mt-0.5 text-sm text-muted-foreground">
        {tb(
          'Tick which tiers get each benefit. "System" benefits are enforced automatically (fees, access); the rest are service promises your team honors.',
          'حدّد الفئات التي تحصل على كل ميزة. مزايا "النظام" تُطبَّق تلقائيًا (رسوم، صلاحيات)؛ والبقية وعود خدمة يلتزم بها فريقك.',
        )}
      </p>
      {sp.saved && <p className="mb-3 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved.', 'تم الحفظ.')}</p>}
      {sp.error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save.', 'تعذّر الحفظ.')}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="p-3 text-start">{tb('Benefit', 'الميزة')}</th>
              {tiers.map((t) => (
                <th key={t.id} scope="col" className="p-3 text-center">{ar ? t.nameAr ?? t.nameEn : t.nameEn}</th>
              ))}
              <th scope="col" className="p-3" />
            </tr>
          </thead>
          <tbody>
            {benefits.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="p-3">
                  <div className="font-medium text-foreground">{ar ? b.nameAr ?? b.nameEn : b.nameEn}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {b.key
                      ? <span className="inline-flex items-center gap-1"><Lock size={11} aria-hidden /> {tb('System — enforced automatically', 'نظام — تُطبَّق تلقائيًا')}</span>
                      : tb('Advertised — honored by your team', 'مُعلنة — يلتزم بها فريقك')}
                  </div>
                </td>
                {tiers.map((t) => {
                  const on = b.tierIds.has(t.id);
                  return (
                    <td key={t.id} className="p-3 text-center">
                      {/* one-click toggle: submits the flipped state */}
                      <form action={toggleTierBenefitAction} className="inline">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="benefitId" value={b.id} />
                        <input type="hidden" name="tierId" value={t.id} />
                        {!on && <input type="hidden" name="granted" value="on" />}
                        <button
                          className={`inline-flex size-7 items-center justify-center rounded-md border transition ${on ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
                          aria-label={`${ar ? b.nameAr ?? b.nameEn : b.nameEn} — ${ar ? t.nameAr ?? t.nameEn : t.nameEn}: ${on ? tb('granted, click to remove', 'ممنوحة، اضغط للإزالة') : tb('not granted, click to grant', 'غير ممنوحة، اضغط للمنح')}`}
                        >
                          {on ? <Check size={15} aria-hidden /> : <Minus size={15} aria-hidden />}
                        </button>
                      </form>
                    </td>
                  );
                })}
                <td className="p-3 text-end">
                  {!b.key && (
                    <form action={deleteManualBenefitAction} className="inline">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-muted-foreground transition hover:text-destructive" aria-label={tb('Delete benefit', 'حذف الميزة')}>
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-6 max-w-xl rounded-lg border border-border p-4">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{tb('Add a benefit (advertised)', 'إضافة ميزة (مُعلنة)')}</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {tb('Benefits that the system must enforce automatically are added in code — ask your developer.', 'المزايا التي يجب أن يطبقها النظام تلقائيًا تُضاف برمجيًا — اطلبها من المطوّر.')}
        </p>
        <form action={createManualBenefitAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{tb('Name (English)', 'الاسم (إنجليزي)')}</span>
            <input name="nameEn" required maxLength={120} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">{tb('Name (Arabic)', 'الاسم (عربي)')}</span>
            <input name="nameAr" dir="rtl" maxLength={120} className={inputCls} />
          </label>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{tb('Add', 'إضافة')}</button>
        </form>
      </section>
    </div>
  );
}
