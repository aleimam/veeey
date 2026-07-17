'use client';

import { useActionState, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createRequestAction, updateRequestAction, type RequestFormState } from '@/server/request-actions';
import { searchCustomersAction } from '@/server/customer-admin-actions';
import type { CustomerHit } from '@/lib/customer-admin-service';
import { requestTypeLabel, requestTypeHint } from '@/lib/request-i18n';
import { REQUEST_TYPES, requiresCustomer, allowsPhotos } from '@/lib/request-logic';
import { pick } from '@/lib/admin-i18n';
import { Field, FormError, inputCls } from './ui';
import { ProductSelect } from './product-select';
import { ImageUploader } from './image-uploader';
import type { InventoryPickerProduct } from '@/server/inventory-actions';

type LineInit = { product: InventoryPickerProduct | null; count: string; sellingPriceEgp: string; notes: string };
const blankLine = (): LineInit => ({ product: null, count: '1', sellingPriceEgp: '', notes: '' });

export type RequestFormInitial = {
  id: string;
  type: string;
  customer: { id: string; name: string } | null;
  notes: string;
  depositEgp: string;
  lines: LineInit[];
  photoUrls: string[];
};

/**
 * Create / edit a purchasing request (Requests epic, mirrors YeldnIN's
 * RequestForm). Type drives the shape: SPECIAL_ORDER adds a customer picker,
 * a deposit field (with a suggested estimate), and photo upload. Product lines
 * submit as index-aligned parallel arrays (lineProductId/lineCount/…) parsed
 * by request-actions. Human-in-the-loop: staff confirm type + quantities.
 */
export function RequestForm({ depositPercent, initial }: { depositPercent: number; initial?: RequestFormInitial }) {
  const locale = useLocale();
  const tb = pick(locale);
  const action = initial ? updateRequestAction : createRequestAction;
  const [state, formAction] = useActionState<RequestFormState, FormData>(action, {});

  const [type, setType] = useState(initial?.type ?? 'RESTOCK');
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(initial?.customer ?? null);
  const [deposit, setDeposit] = useState(initial?.depositEgp ?? '');
  const [lines, setLines] = useState<LineInit[]>(initial?.lines?.length ? initial.lines : [blankLine()]);

  const isSpecial = requiresCustomer(type);
  const setLine = (i: number, patch: Partial<LineInit>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  // Suggested deposit = depositPercent% of Σ(count × selling price), in EGP.
  const estimate = Math.round(
    lines.reduce((s, l) => s + (Number(l.count) || 0) * (Number(l.sellingPriceEgp) || 0), 0) * (depositPercent || 0),
  ) / 100;

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {isSpecial && <input type="hidden" name="customerId" value={customer?.id ?? ''} />}

      <Field label={tb('Request type', 'نوع الطلب')} hint={requestTypeHint(tb, type)} required>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          {REQUEST_TYPES.map((ty) => <option key={ty} value={ty}>{requestTypeLabel(tb, ty)}</option>)}
        </select>
      </Field>

      {isSpecial && (
        <div className="rounded-lg border border-border p-3">
          <div className="text-sm font-medium">{tb('Customer', 'العميل')} <span aria-hidden className="text-destructive">*</span></div>
          <p className="mb-2 text-xs text-muted-foreground">{tb('A special order is placed for a specific customer.', 'يُنشأ الطلب الخاص لعميل محدد.')}</p>
          <CustomerPicker value={customer} onChange={setCustomer} tb={tb} error={state.fields?.customer} />
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">{tb('Products', 'المنتجات')} <span aria-hidden className="text-destructive">*</span></span>
          <button type="button" onClick={() => setLines((p) => [...p, blankLine()])} className="text-xs font-medium text-primary hover:underline">
            + {tb('Add product', 'إضافة منتج')}
          </button>
        </div>
        {state.fields?.lines && <p className="mb-2 text-sm text-destructive">{tb('Add at least one product with a quantity.', 'أضف منتجًا واحدًا على الأقل مع الكمية.')}</p>}
        <div className="space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <ProductSelect
                name="lineProductId"
                initial={l.product}
                onSelect={(p) => setLine(i, { product: p, sellingPriceEgp: l.sellingPriceEgp || (p ? String(p.basePriceEgp) : '') })}
              />
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-12">
                <label className="text-xs font-medium sm:col-span-3">
                  {tb('Qty', 'الكمية')}
                  <input name="lineCount" type="number" min={1} value={l.count} onChange={(e) => setLine(i, { count: e.target.value })} className={inputCls} />
                </label>
                <label className="text-xs font-medium sm:col-span-3">
                  {tb('Selling price', 'سعر البيع')}
                  <input name="lineSellingPrice" type="number" step="0.01" min={0} value={l.sellingPriceEgp} onChange={(e) => setLine(i, { sellingPriceEgp: e.target.value })} placeholder={tb('EGP', 'ج.م')} className={inputCls} />
                </label>
                <label className="text-xs font-medium sm:col-span-4">
                  {tb('Line note', 'ملاحظة السطر')}
                  <input name="lineNotes" value={l.notes} onChange={(e) => setLine(i, { notes: e.target.value })} className={inputCls} />
                </label>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="button"
                    onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="w-full rounded-md border border-border px-2 py-2 text-xs text-destructive hover:bg-surface disabled:opacity-30"
                  >
                    {tb('Remove', 'حذف')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isSpecial && (
        <div className="sm:max-w-xs">
          <Field label={tb('Deposit (EGP)', 'العربون (ج.م)')}>
            <input name="depositEgp" type="number" step="0.01" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputCls} />
          </Field>
          {estimate > 0 && (
            <button type="button" onClick={() => setDeposit(String(estimate))} className="mt-1 text-xs text-primary hover:underline">
              {tb('Suggested', 'مقترح')}: {estimate.toLocaleString()} {tb('EGP', 'ج.م')} — {tb('use estimate', 'استخدم التقدير')}
            </button>
          )}
        </div>
      )}

      <Field label={tb('Notes', 'ملاحظات')}>
        <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ''} className={inputCls} />
      </Field>

      {isSpecial && allowsPhotos(type) && (
        <div>
          <div className="mb-1 text-sm font-medium">{tb('Photos', 'الصور')}</div>
          <ImageUploader name="photoUrls" initial={initial?.photoUrls ?? []} />
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          {initial ? tb('Save request', 'حفظ الطلب') : tb('Create request', 'إنشاء الطلب')}
        </button>
        <Link href="/admin/requests" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}

/** Inline searchable customer picker for special orders. */
function CustomerPicker({
  value, onChange, tb, error,
}: {
  value: { id: string; name: string } | null;
  onChange: (c: { id: string; name: string } | null) => void;
  tb: ReturnType<typeof pick>;
  error?: string;
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const seq = useRef(0);

  async function run(term: string) {
    setQ(term);
    const my = ++seq.current;
    if (term.trim().length < 2) { setHits([]); return; }
    const res = await searchCustomersAction(term);
    if (my === seq.current) setHits(res);
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-card p-2 text-sm">
        <span className="font-medium">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface">{tb('Change', 'تغيير')}</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={q} onChange={(e) => run(e.target.value)} placeholder={tb('Search customers by name, phone or email…', 'ابحث عن العملاء بالاسم أو الهاتف أو البريد…')} className={inputCls} />
      {error && <p className="mt-1 text-sm text-destructive">{tb('Select a customer for the special order.', 'اختر عميلًا للطلب الخاص.')}</p>}
      {hits.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
          {hits.map((h) => (
            <button key={h.id} type="button" onClick={() => { onChange({ id: h.id, name: h.name }); setQ(''); setHits([]); }} className="block w-full px-2.5 py-2 text-start hover:bg-surface">
              <span className="block text-sm font-medium">{h.name}</span>
              <span className="block text-xs text-muted-foreground">{h.phone ?? ''}{h.email ? ` · ${h.email}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
