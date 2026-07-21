import { requirePermission } from '@/lib/auth-guards';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { conditionLabel } from '@/lib/lot-condition';
import {
  listSpillageReasons, recentSpillage, spillageReport, searchLotsForSpillage,
} from '@/lib/spillage-service';
import { dayRangeFilter } from '@/lib/date-filter';
import {
  recordSpillageAction, voidSpillageAction, saveSpillageReasonAction, deleteSpillageReasonAction,
} from '@/server/spillage-actions';

export const dynamic = 'force-dynamic';

export default async function SpillagePage({
  params, searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  await requirePermission('inventory.manage');
  const tb = pick(locale);

  const range = dayRangeFilter(sp.from, sp.to);
  const [reasons, report, recent, lots] = await Promise.all([
    listSpillageReasons(),
    spillageReport({ from: range?.gte, to: range?.lt }),
    recentSpillage(60),
    sp.q ? searchLotsForSpillage(sp.q) : Promise.resolve([]),
  ]);
  const reasonLabel = (code: string) => {
    const r = reasons.find((x) => x.code === code);
    return r ? (locale === 'ar' ? r.labelAr || r.labelEn : r.labelEn) : code;
  };
  const hidden = (o: Record<string, string>) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(o).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );
  const fmtDate = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold text-foreground">{tb('Spillage & damage', 'الهدر والتلف')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tb('Move units to a damage state: write off (Lost/Damaged) or resell as a discounted variant. Reports include stock lost to expiry.',
              'انقل الوحدات إلى حالة تلف: شطب (مفقود/تالف) أو إعادة بيع كنسخة مخفّضة. تشمل التقارير المخزون المفقود بانتهاء الصلاحية.')}
        </p>
      </div>

      {/* ── Loss report ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">{tb('Loss report', 'تقرير الفاقد')}</h2>
          <form className="flex items-end gap-2 text-xs">
            <input type="hidden" name="q" value={sp.q ?? ''} />
            <label className="flex flex-col gap-1">{tb('From', 'من')}<input type="date" name="from" defaultValue={sp.from} className="rounded-md border border-border bg-background px-2 py-1" /></label>
            <label className="flex flex-col gap-1">{tb('To', 'إلى')}<input type="date" name="to" defaultValue={sp.to} className="rounded-md border border-border bg-background px-2 py-1" /></label>
            <button className="rounded-md border border-border px-2.5 py-1 hover:bg-surface">{tb('Apply', 'تطبيق')}</button>
          </form>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={tb('Total units lost/moved', 'إجمالي الوحدات')} value={String(report.totalUnits)} />
          <Stat label={tb('Value', 'القيمة')} value={report.totalValue == null ? '—' : formatEGP(Number(report.totalValue))} hint={report.totalValue == null ? tb('cost data not available', 'لا تتوفر بيانات التكلفة') : undefined} />
          <Stat label={tb('Reasons used', 'الأسباب')} value={String(report.rows.length)} />
        </div>
        {report.rows.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead><tr className="text-start text-xs uppercase text-muted-foreground">
                <th className="py-1 text-start">{tb('Reason', 'السبب')}</th><th className="text-start">{tb('Type', 'النوع')}</th><th className="text-end">{tb('Units', 'الوحدات')}</th><th className="text-end">{tb('Value', 'القيمة')}</th>
              </tr></thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.reasonCode} className="border-t border-border">
                    <td className="py-1.5">{reasonLabel(r.reasonCode)}</td>
                    <td className="text-muted-foreground">{r.sellable ? tb('Resold', 'أُعيد بيعها') : tb('Written off', 'مشطوبة')}</td>
                    <td className="text-end">{r.units}</td>
                    <td className="text-end">{r.valuePiastres == null ? '—' : formatEGP(Number(r.valuePiastres))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Record a spillage ───────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Record spillage', 'تسجيل هدر')}</h2>
        <form className="mb-3 flex gap-2">
          <input type="hidden" name="from" value={sp.from ?? ''} /><input type="hidden" name="to" value={sp.to ?? ''} />
          <input name="q" defaultValue={sp.q} placeholder={tb('Search product by SKU or name…', 'ابحث بالكود أو الاسم…')} className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm" />
          <button className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface">{tb('Find lots', 'ابحث عن الدفعات')}</button>
        </form>
        {sp.q && lots.length === 0 && <p className="text-sm text-muted-foreground">{tb('No in-stock lots match.', 'لا توجد دفعات مطابقة بالمخزون.')}</p>}
        <div className="space-y-3">
          {lots.map((l) => (
            <form key={l.id} action={recordSpillageAction} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
              {hidden({ lotId: l.id })}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{(locale === 'ar' ? l.product.nameAr : l.product.nameEn) ?? l.product.nameEn}</div>
                <div className="text-xs text-muted-foreground">
                  {l.product.sku} · {conditionLabel(l.condition, locale)} · {tb('in stock', 'بالمخزون')} {l.qtyOnHand}
                  {l.expiryDate ? ` · ${tb('exp', 'انتهاء')} ${l.expiryDate.toISOString().slice(0, 10)}` : ''}
                </div>
              </div>
              <label className="flex flex-col gap-1 text-xs">{tb('Qty', 'الكمية')}<input name="qty" type="number" min={1} max={l.qtyOnHand} required className="w-20 rounded-md border border-border bg-background px-2 py-1" /></label>
              <label className="flex flex-col gap-1 text-xs">{tb('Reason', 'السبب')}
                <select name="reasonCode" required className="rounded-md border border-border bg-background px-2 py-1">
                  {reasons.filter((r) => r.active && !r.isSystem).map((r) => (
                    <option key={r.code} value={r.code}>{(locale === 'ar' ? r.labelAr || r.labelEn : r.labelEn)}{r.sellable ? ` (${tb('resell', 'بيع')})` : ` (${tb('write-off', 'شطب')})`}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">{tb('Resell price EGP', 'سعر البيع')}<input name="priceEgp" type="number" step="0.01" min={0} placeholder={tb('if resell', 'للبيع')} className="w-28 rounded-md border border-border bg-background px-2 py-1" /></label>
              <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{tb('Record', 'تسجيل')}</button>
            </form>
          ))}
        </div>
      </section>

      {/* ── History (with void) ─────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Recent entries', 'أحدث الإدخالات')}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tb('Nothing recorded yet.', 'لا يوجد شيء بعد.')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="text-start text-xs uppercase text-muted-foreground">
                <th className="py-1 text-start">{tb('When', 'التاريخ')}</th><th className="text-start">{tb('Product', 'المنتج')}</th><th className="text-start">{tb('Reason', 'السبب')}</th><th className="text-end">{tb('Qty', 'الكمية')}</th><th></th>
              </tr></thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} className={`border-t border-border ${e.voidedAt ? 'text-muted-foreground line-through' : ''}`}>
                    <td className="py-1.5 whitespace-nowrap text-xs">{fmtDate(e.createdAt)}</td>
                    <td className="truncate">{(locale === 'ar' ? e.product.nameAr : e.product.nameEn) ?? e.product.nameEn}<span className="ms-1 text-xs text-muted-foreground">{e.product.sku}</span></td>
                    <td>{reasonLabel(e.reasonCode)} <span className="text-xs text-muted-foreground">{e.sellable ? tb('resold', 'بيع') : tb('write-off', 'شطب')}</span></td>
                    <td className="text-end">{e.qty}</td>
                    <td className="text-end">
                      {e.canVoid && (
                        <form action={voidSpillageAction}>{hidden({ id: e.id })}<button className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface">{tb('Void', 'إلغاء')}</button></form>
                      )}
                      {e.voidedAt && <span className="text-xs">{tb('voided', 'ملغى')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Reason management ───────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tb('Damage reasons', 'أسباب التلف')}</h2>
        <div className="space-y-2">
          {reasons.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
              <span className="flex-1">{r.labelEn}{r.labelAr ? ` / ${r.labelAr}` : ''}</span>
              <span className="rounded px-2 py-0.5 text-xs" style={{ background: r.sellable ? 'var(--green-wash)' : 'var(--gold-wash)' }}>{r.sellable ? tb('resell', 'بيع') : tb('write-off', 'شطب')}</span>
              {!r.active && <span className="text-xs text-muted-foreground">{tb('inactive', 'غير مفعّل')}</span>}
              {r.isSystem && <span className="text-xs text-muted-foreground">{tb('system', 'نظام')}</span>}
              {!r.isSystem && (
                <form action={deleteSpillageReasonAction}>{hidden({ id: r.id })}<button className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-surface">{tb('Delete', 'حذف')}</button></form>
              )}
            </div>
          ))}
        </div>
        <form action={saveSpillageReasonAction} className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
          {hidden({})}
          <label className="flex flex-col gap-1 text-xs">{tb('Code', 'الكود')}<input name="code" required placeholder="NO_BOX" className="w-32 rounded-md border border-border bg-background px-2 py-1" /></label>
          <label className="flex flex-col gap-1 text-xs">{tb('Label EN', 'الاسم EN')}<input name="labelEn" required className="rounded-md border border-border bg-background px-2 py-1" /></label>
          <label className="flex flex-col gap-1 text-xs">{tb('Label AR', 'الاسم AR')}<input name="labelAr" className="rounded-md border border-border bg-background px-2 py-1" /></label>
          <label className="flex items-center gap-1 text-xs"><input name="sellable" type="checkbox" /> {tb('Sellable (resell)', 'قابل للبيع')}</label>
          <input type="hidden" name="active" value="on" />
          <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">{tb('Add reason', 'إضافة سبب')}</button>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
