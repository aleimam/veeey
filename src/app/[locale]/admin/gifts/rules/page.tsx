import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requirePermission } from '@/lib/auth-guards';
import { listGiftRules } from '@/lib/gift-rule-service';
import { listGifts } from '@/lib/gift-service';
import { listCategories } from '@/lib/taxonomy-service';
import { saveGiftRuleAction, toggleGiftRuleAction, deleteGiftRuleAction } from '@/server/gift-rule-actions';
import { formatEGP } from '@/lib/format';
import { inputCls } from '@/components/admin/ui';
import { ConfirmButton } from '@/components/admin/confirm-button';
import { pick } from '@/lib/admin-i18n';

export const dynamic = 'force-dynamic';
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Gift-with-purchase rules (owner growth feature): orders meeting a rule's
 *  conditions get its gift auto-attached at checkout / staff order creation. */
export default async function GiftRulesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requirePermission('orders.write');
  const tb = pick(locale);

  const [rules, giftsRaw, cats] = await Promise.all([listGiftRules(), listGifts(), listCategories()]);
  const gifts = giftsRaw.filter((g) => !g.archivedAt);
  const flag = one(sp.error) ?? (one(sp.done) ? 'done' : undefined);

  const fmtDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const conditions = (r: (typeof rules)[number]): string[] => {
    const parts: string[] = [];
    if (r.minSubtotalPiastres != null) parts.push(`${tb('Subtotal ≥', 'الإجمالي ≥')} ${formatEGP(Number(r.minSubtotalPiastres))}`);
    if (r.product) parts.push(`${tb('Contains', 'يتضمن')} ${r.product.nameEn} (${r.product.sku})`);
    if (r.category) parts.push(`${tb('Category', 'الفئة')}: ${r.category.nameEn}`);
    if (r.startsAt || r.endsAt) parts.push(`${fmtDate(r.startsAt) ?? '…'} → ${fmtDate(r.endsAt) ?? '…'}`);
    return parts;
  };

  return (
    <div className="p-6">
      <Link href="/admin/gifts" className="text-sm text-primary hover:underline">← {tb('Gifts', 'الهدايا')}</Link>
      <h1 className="mb-1 mt-2 font-heading text-xl font-semibold">{tb('Gift-with-purchase rules', 'قواعد الهدية مع الشراء')} ({rules.length})</h1>
      <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
        {tb(
          'When an order meets all of a rule\'s conditions, the gift is added automatically at checkout (and on staff orders). Out-of-stock gifts are skipped — the order always goes through. The rule name is what the customer sees in the cart.',
          'عندما يحقق الطلب كل شروط قاعدة، تُضاف الهدية تلقائيًا عند الدفع (وفي طلبات الموظفين). تُتخطى الهدايا غير المتوفرة — الطلب يمر دائمًا. اسم القاعدة هو ما يراه العميل في السلة.',
        )}
      </p>

      {flag === 'done' && <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{tb('Saved ✓', 'تم الحفظ ✓')}</p>}
      {flag === 'sku' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('No product with that SKU.', 'لا يوجد منتج بهذا الرمز.')}</p>}
      {flag === 'conditions' && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('A rule needs at least one condition (subtotal, product, or category).', 'تحتاج القاعدة شرطًا واحدًا على الأقل (إجمالي أو منتج أو فئة).')}</p>}
      {(flag === 'invalid' || flag === 'forbidden') && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{tb('Could not save — check the values.', 'تعذّر الحفظ — راجع القيم.')}</p>}

      <div className="mb-8 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-start">{tb('Rule (shown to customer)', 'القاعدة (تظهر للعميل)')}</th>
              <th className="p-3 text-start">{tb('Conditions', 'الشروط')}</th>
              <th className="p-3 text-start">{tb('Gift', 'الهدية')}</th>
              <th className="p-3 text-start">{tb('Status', 'الحالة')}</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className={`border-t border-border ${!r.active ? 'opacity-60' : ''}`}>
                <td className="p-3">
                  <div className="font-medium">{r.nameEn}</div>
                  {r.nameAr && <div className="text-xs text-muted-foreground" dir="rtl">{r.nameAr}</div>}
                </td>
                <td className="p-3 text-xs text-muted-foreground">{conditions(r).map((c, i) => <div key={i}>{c}</div>)}</td>
                <td className="p-3">
                  {r.gift.internalName} <span className="text-xs text-muted-foreground">({r.gift.code})</span>{r.giftQty > 1 ? ` ×${r.giftQty}` : ''}
                  <div className={`text-xs ${r.gift.stock <= 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{tb(`stock ${r.gift.stock}`, `المخزون ${r.gift.stock}`)}</div>
                </td>
                <td className="p-3">
                  <form action={toggleGiftRuleAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="active" value={r.active ? '0' : '1'} />
                    <button className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {r.active ? tb('Active — click to pause', 'مفعّلة — اضغط للإيقاف') : tb('Paused — click to activate', 'موقوفة — اضغط للتفعيل')}
                    </button>
                  </form>
                </td>
                <td className="p-3 text-end">
                  <form action={deleteGiftRuleAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmButton warn={tb(`Delete the rule "${r.nameEn}"?`, `حذف القاعدة "${r.nameEn}"؟`)} className="text-xs text-destructive hover:underline">
                      {tb('Delete', 'حذف')}
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{tb('No rules yet — create the first one below.', 'لا توجد قواعد بعد — أنشئ الأولى بالأسفل.')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <form action={saveGiftRuleAction} className="max-w-3xl space-y-4 rounded-lg border border-border p-4">
        <p className="text-sm font-semibold">{tb('New rule', 'قاعدة جديدة')}</p>
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {tb('Name (English — customer-facing)', 'الاسم (إنجليزي — يظهر للعميل)')}
            <input name="nameEn" required placeholder={tb('e.g. Free shaker bottle', 'مثال: زجاجة شيكر مجانية')} className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            {tb('Name (Arabic)', 'الاسم (عربي)')}
            <input name="nameAr" dir="rtl" className={inputCls} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {tb('Gift', 'الهدية')}
            <select name="giftId" required className={inputCls}>
              {gifts.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.internalName} ({tb('stock', 'مخزون')} {g.stock})</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            {tb('Gift quantity', 'كمية الهدية')}
            <input name="giftQty" type="number" min={1} defaultValue={1} className={inputCls} />
          </label>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tb('Conditions (all that are set must match — at least one required)', 'الشروط (يجب تحقق كل ما يُحدد — شرط واحد على الأقل)')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            {tb('Order subtotal ≥ (EGP)', 'إجمالي الطلب ≥ (ج.م)')}
            <input name="minSubtotalEgp" type="number" min={0} step="0.01" placeholder="—" className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            {tb('Contains product SKU', 'يتضمن منتجًا برمز SKU')}
            <input name="productSku" placeholder="VY-…" className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            {tb('Contains category', 'يتضمن فئة')}
            <select name="categoryId" className={inputCls}>
              <option value="">{tb('— none —', '— بدون —')}</option>
              {cats.filter((c) => !c.archivedAt).map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            {tb('Starts (optional)', 'يبدأ (اختياري)')}
            <input name="startsAt" type="date" className={inputCls} />
          </label>
          <label className="block text-sm font-medium">
            {tb('Ends (optional)', 'ينتهي (اختياري)')}
            <input name="endsAt" type="date" className={inputCls} />
          </label>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">{tb('Create rule', 'إنشاء القاعدة')}</button>
      </form>
    </div>
  );
}
