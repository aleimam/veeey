'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from '@/components/admin/ui';
import { ProductSelect } from '@/components/admin/product-select';
import { saveVariantGroupAction } from '@/server/variant-actions';
import { MAX_AXES } from '@/lib/variant-groups';
import type { GroupDetail } from '@/lib/variant-service';

type Axis = { nameEn: string; nameAr: string };
type Member = { productId: string; nameEn: string; sku: string; values: ({ en: string; ar: string } | null)[] };

/** Variant-group editor: internal name, up to MAX_AXES bilingual axes, and the
 *  member products with one value per axis. Members are ordered by row position
 *  (row order = variantSort = chip order on the PDP). */
export function VariantGroupEditor({ initial, locale }: { initial: GroupDetail | null; locale: string }) {
  const t = pick(locale);
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [axes, setAxes] = useState<Axis[]>(initial?.axes.map((a) => ({ nameEn: a.nameEn, nameAr: a.nameAr })) ?? [{ nameEn: '', nameAr: '' }]);
  const [members, setMembers] = useState<Member[]>(initial?.members.map((m) => ({ productId: m.productId, nameEn: m.nameEn, sku: m.sku, values: m.values })) ?? []);
  const [pickerKey, setPickerKey] = useState(0); // remount ProductSelect after each pick
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setAxis = (i: number, patch: Partial<Axis>) => setAxes((a) => a.map((x, xi) => (xi === i ? { ...x, ...patch } : x)));
  const setValue = (mi: number, ai: number, patch: Partial<{ en: string; ar: string }>) =>
    setMembers((ms) => ms.map((m, i) => {
      if (i !== mi) return m;
      const values = [...m.values];
      const cur = values[ai] ?? { en: '', ar: '' };
      values[ai] = { ...cur, ...patch };
      return { ...m, values };
    }));
  const move = (mi: number, dir: -1 | 1) => setMembers((ms) => {
    const to = mi + dir;
    if (to < 0 || to >= ms.length) return ms;
    const next = [...ms];
    [next[mi], next[to]] = [next[to], next[mi]];
    return next;
  });

  const save = () => start(async () => {
    setMsg(null);
    const r = await saveVariantGroupAction({
      id: initial?.id,
      name,
      axes: axes.filter((a) => a.nameEn.trim()),
      members: members.map((m, i) => ({ productId: m.productId, sort: i, values: m.values.map((v) => (v && v.en.trim() ? { en: v.en, ar: v.ar || v.en } : null)) })),
    });
    if (r.error) {
      setMsg({
        kind: 'err',
        text: r.error === 'forbidden' ? t("You don't have permission.", 'ليس لديك صلاحية.')
          : r.error === 'invalid' ? t('Needs a name, at least one axis, and at least 2 member products.', 'يلزم اسم ومحور واحد على الأقل ومنتجان عضوان على الأقل.')
          : t('Could not save.', 'تعذّر الحفظ.'),
      });
      return;
    }
    router.push(`/${locale}/admin/variant-groups?saved=1`);
  });

  const label = 'mb-1 block text-xs font-medium text-muted-foreground';
  const card = 'rounded-xl border border-border bg-card p-4';

  return (
    <div className="space-y-4">
      {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.kind === 'ok' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{msg.text}</div>}

      <div className={card}>
        <label className={label}>{t('Group name (internal)', 'اسم المجموعة (داخلي)')}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder={t('e.g. HyperGH 14X family', 'مثال: عائلة HyperGH 14X')} />
      </div>

      <div className={card}>
        <h2 className="mb-2 font-heading text-sm font-semibold text-foreground">{t('Axes (what varies between the products)', 'المحاور (ما يختلف بين المنتجات)')}</h2>
        <div className="space-y-2">
          {axes.map((a, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <div className="w-52"><label className={label}>{t(`Axis ${i + 1} — English`, `المحور ${i + 1} — إنجليزي`)}</label>
                <input value={a.nameEn} onChange={(e) => setAxis(i, { nameEn: e.target.value })} className={inputCls} placeholder={t('Size / Flavor / Strength', 'Size / Flavor / Strength')} /></div>
              <div className="w-52"><label className={label}>{t('Arabic', 'عربي')}</label>
                <input value={a.nameAr} dir="rtl" onChange={(e) => setAxis(i, { nameAr: e.target.value })} className={inputCls} placeholder={t('الحجم / النكهة', 'الحجم / النكهة')} /></div>
              {axes.length > 1 && (
                <button type="button" onClick={() => { setAxes((x) => x.filter((_, xi) => xi !== i)); setMembers((ms) => ms.map((m) => ({ ...m, values: m.values.filter((_, vi) => vi !== i) }))); }} className="h-9 rounded-md border border-border px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10">{t('Remove', 'إزالة')}</button>
              )}
            </div>
          ))}
        </div>
        {axes.length < MAX_AXES && (
          <button type="button" onClick={() => setAxes((a) => [...a, { nameEn: '', nameAr: '' }])} className="mt-3 h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-surface">{t('+ Add axis', '+ أضف محورًا')}</button>
        )}
      </div>

      <div className={card}>
        <h2 className="mb-2 font-heading text-sm font-semibold text-foreground">{t('Member products', 'المنتجات الأعضاء')} <span className="text-xs font-normal text-muted-foreground">({members.length})</span></h2>
        <p className="mb-3 text-xs text-muted-foreground">{t('Row order = chip order on the product page. Give each product a value per axis (e.g. “120 tablets”).', 'ترتيب الصفوف = ترتيب الأزرار في صفحة المنتج. أعطِ كل منتج قيمة لكل محور (مثل «١٢٠ قرصًا»).')}</p>

        <div className="space-y-3">
          {members.map((m, mi) => (
            <div key={m.productId} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{m.nameEn}</span>
                <span className="text-[11px] text-muted-foreground">{m.sku}</span>
                <span className="ms-auto flex items-center gap-1">
                  <button type="button" onClick={() => move(mi, -1)} disabled={mi === 0} className="h-7 rounded border border-border px-2 text-xs disabled:opacity-40">↑</button>
                  <button type="button" onClick={() => move(mi, 1)} disabled={mi === members.length - 1} className="h-7 rounded border border-border px-2 text-xs disabled:opacity-40">↓</button>
                  <button type="button" onClick={() => setMembers((ms) => ms.filter((_, i) => i !== mi))} className="h-7 rounded border border-border px-2 text-xs font-medium text-destructive hover:bg-destructive/10">{t('Remove', 'إزالة')}</button>
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {axes.map((a, ai) => (
                  <div key={ai}>
                    <label className={label}>{a.nameEn || t(`Axis ${ai + 1}`, `المحور ${ai + 1}`)}</label>
                    <div className="flex gap-1.5">
                      <input value={m.values[ai]?.en ?? ''} onChange={(e) => setValue(mi, ai, { en: e.target.value })} className={inputCls} placeholder="EN" />
                      <input value={m.values[ai]?.ar ?? ''} dir="rtl" onChange={(e) => setValue(mi, ai, { ar: e.target.value })} className={inputCls} placeholder="AR" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 max-w-md">
          <label className={label}>{t('Add a product', 'أضف منتجًا')}</label>
          <ProductSelect
            key={pickerKey}
            name="_variantPick"
            onSelect={(p) => {
              if (!p) return;
              setMembers((ms) => (ms.some((m) => m.productId === p.id) ? ms : [...ms, { productId: p.id, nameEn: p.name, sku: p.sku, values: axes.map(() => null) }]));
              setPickerKey((k) => k + 1);
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {pending ? t('Saving…', 'جارٍ الحفظ…') : t('Save group', 'حفظ المجموعة')}
        </button>
        <button type="button" onClick={() => router.push(`/${locale}/admin/variant-groups`)} className="h-9 rounded-md border border-border px-4 text-sm font-medium hover:bg-surface">{t('Cancel', 'إلغاء')}</button>
      </div>
    </div>
  );
}
