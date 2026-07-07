'use client';

import { useState, useTransition } from 'react';
import { inputCls } from '@/components/admin/ui';
import { Icon, ICON_NAMES } from '@/components/storefront/ui/icon';
import { saveNavAction, resetNavAction } from '@/server/nav-actions';
import {
  defaultNav, NAV_COLORS, NAV_FONTS,
  type NavConfig, type NavItem, type NavMegaColumn, type NavMegaLink, type NavMegaPromo,
} from '@/lib/nav-config';

type Pick2 = (en: string, ar: string) => string;
const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

const card = 'rounded-xl border border-border bg-card p-4';
const label = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground';
const btn = 'rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface';
const iconBtn = 'flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface disabled:opacity-40';

/** Color picker: preset swatches + a free hex/CSS value. */
function ColorField({ value, onChange, allowInherit }: { value: string; onChange: (v: string) => void; allowInherit?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowInherit && (
        <button type="button" onClick={() => onChange('')} className={`h-7 rounded-md border px-2 text-[11px] ${!value ? 'border-primary bg-primary/10' : 'border-border'}`}>
          Inherit
        </button>
      )}
      {NAV_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className={`size-7 rounded-md border ${value === c.value ? 'ring-2 ring-primary' : 'border-border'}`}
          style={{ background: c.value }}
        />
      ))}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#hex / var(--x)" className={`${inputCls} h-7 w-28 text-xs`} />
    </div>
  );
}

function TextRow({ labelEn, en, ar, onEn, onAr }: { labelEn: string; en: string; ar: string; onEn: (v: string) => void; onAr: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className={label}>{labelEn} (EN)<input value={en} onChange={(e) => onEn(e.target.value)} className={inputCls} /></label>
      <label className={label} dir="rtl">{labelEn} (AR)<input value={ar} onChange={(e) => onAr(e.target.value)} className={inputCls} /></label>
    </div>
  );
}

export function NavEditor({ initial, locale }: { initial: NavConfig; locale: string }) {
  const t: Pick2 = (en, ar) => (locale === 'ar' ? ar : en);
  const [cfg, setCfg] = useState<NavConfig>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const set = (patch: Partial<NavConfig>) => setCfg((c) => ({ ...c, ...patch }));
  const setItem = (id: string, patch: Partial<NavItem>) => set({ items: cfg.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= cfg.items.length) return;
    const items = [...cfg.items];
    [items[idx], items[j]] = [items[j], items[idx]];
    set({ items });
  };
  const addItem = () =>
    set({ items: [...cfg.items, { id: uid('item'), labelEn: 'New item', labelAr: 'عنصر جديد', href: '/', icon: '', color: '', bold: true, sizePx: null, visible: true, mega: null }] });
  const removeItem = (id: string) => set({ items: cfg.items.filter((i) => i.id !== id) });

  // ── mega helpers (operate on one item) ──
  const toggleMega = (item: NavItem, on: boolean) =>
    setItem(item.id, { mega: on ? { columns: item.mega?.columns ?? [], promo: item.mega?.promo ?? null } : null });
  const updColumns = (item: NavItem, cols: NavMegaColumn[]) => setItem(item.id, { mega: { columns: cols, promo: item.mega?.promo ?? null } });

  const save = () =>
    start(async () => {
      await saveNavAction(JSON.stringify(cfg));
      setStatus(t('Saved ✓', 'تم الحفظ ✓'));
    });
  const reset = () =>
    start(async () => {
      await resetNavAction();
      setCfg(defaultNav());
      setOpenId(null);
      setStatus(t('Reset to default', 'أُعيد للوضع الافتراضي'));
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(320px,380px)]">
      <div className="space-y-6">
        {/* Bar-level settings */}
        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">{t('Bar style', 'نمط الشريط')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              {t('Font', 'الخط')}
              <select
                value={NAV_FONTS.some((f) => f.value === cfg.fontFamily) ? cfg.fontFamily : '__custom__'}
                onChange={(e) => set({ fontFamily: e.target.value === '__custom__' ? cfg.fontFamily || 'Poppins' : e.target.value })}
                className={inputCls}
              >
                {NAV_FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                <option value="__custom__">{t('Custom Google font…', 'خط Google مخصّص…')}</option>
              </select>
            </label>
            <label className={label}>
              {t('Custom Google font name', 'اسم خط Google')}
              <input value={cfg.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} placeholder="e.g. Poppins" className={inputCls} />
            </label>
            <label className={label}>
              {t('Base font size (px)', 'حجم الخط الأساسي')}
              <input type="number" min={10} max={40} value={cfg.baseSizePx} onChange={(e) => set({ baseSizePx: Number(e.target.value) || 15 })} className={inputCls} />
            </label>
            <div className={label}>{t('Base color', 'اللون الأساسي')}<ColorField value={cfg.baseColor} onChange={(v) => set({ baseColor: v || '#ffffff' })} /></div>
          </div>
        </section>

        {/* Right-aligned promo */}
        <section className={card}>
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <input type="checkbox" checked={cfg.promo.enabled} onChange={(e) => set({ promo: { ...cfg.promo, enabled: e.target.checked } })} />
            {t('Right-side promo text', 'نص العرض الجانبي')}
          </label>
          {cfg.promo.enabled && (
            <div className="space-y-2">
              <TextRow labelEn={t('Text', 'النص')} en={cfg.promo.textEn} ar={cfg.promo.textAr} onEn={(v) => set({ promo: { ...cfg.promo, textEn: v } })} onAr={(v) => set({ promo: { ...cfg.promo, textAr: v } })} />
              <div className="grid grid-cols-2 gap-2">
                <label className={label}>{t('Link (optional)', 'رابط (اختياري)')}<input value={cfg.promo.href} onChange={(e) => set({ promo: { ...cfg.promo, href: e.target.value } })} placeholder="/refill" className={inputCls} /></label>
                <div className={label}>{t('Color', 'اللون')}<ColorField value={cfg.promo.color} onChange={(v) => set({ promo: { ...cfg.promo, color: v } })} /></div>
              </div>
            </div>
          )}
        </section>

        {/* Items */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{t('Menu items', 'عناصر القائمة')}</h2>
            <button type="button" onClick={addItem} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">+ {t('Add item', 'إضافة عنصر')}</button>
          </div>
          {cfg.items.map((it, idx) => (
            <div key={it.id} className={`${card} ${!it.visible ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button type="button" className={iconBtn} disabled={idx === 0} onClick={() => move(idx, -1)} aria-label="Up"><Icon name="chevron-down" size={13} className="rotate-180" /></button>
                  <button type="button" className={iconBtn} disabled={idx === cfg.items.length - 1} onClick={() => move(idx, 1)} aria-label="Down"><Icon name="chevron-down" size={13} /></button>
                </div>
                {it.icon && <Icon name={it.icon} size={16} />}
                <button type="button" onClick={() => setOpenId(openId === it.id ? null : it.id)} className="flex-1 text-start text-sm font-semibold text-foreground">
                  {it.labelEn || t('(untitled)', '(بدون عنوان)')}
                  {it.mega && <span className="ms-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t('dropdown', 'قائمة')}</span>}
                  {!it.visible && <span className="ms-2 text-[10px] text-muted-foreground">{t('hidden', 'مخفي')}</span>}
                </button>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" checked={it.visible} onChange={(e) => setItem(it.id, { visible: e.target.checked })} />{t('Show', 'عرض')}</label>
                <button type="button" onClick={() => removeItem(it.id)} className={`${iconBtn} text-destructive`} aria-label="Delete"><Icon name="x" size={14} /></button>
              </div>

              {openId === it.id && (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <TextRow labelEn={t('Label', 'التسمية')} en={it.labelEn} ar={it.labelAr} onEn={(v) => setItem(it.id, { labelEn: v })} onAr={(v) => setItem(it.id, { labelAr: v })} />
                  <label className={label}>{t('Link', 'الرابط')}<input value={it.href} onChange={(e) => setItem(it.id, { href: e.target.value })} placeholder="/products" className={inputCls} /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={label}>
                      {t('Icon', 'الأيقونة')}
                      <select value={it.icon} onChange={(e) => setItem(it.id, { icon: e.target.value })} className={inputCls}>
                        <option value="">{t('— none —', '— بدون —')}</option>
                        {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className={label}>
                      {t('Font size (px, blank = base)', 'حجم الخط (فارغ = الأساسي)')}
                      <input type="number" min={10} max={40} value={it.sizePx ?? ''} onChange={(e) => setItem(it.id, { sizePx: e.target.value === '' ? null : Number(e.target.value) })} className={inputCls} />
                    </label>
                    <div className={label}>{t('Text color', 'لون النص')}<ColorField value={it.color} onChange={(v) => setItem(it.id, { color: v })} allowInherit /></div>
                    <label className="flex items-center gap-2 self-end text-xs text-foreground"><input type="checkbox" checked={it.bold} onChange={(e) => setItem(it.id, { bold: e.target.checked })} />{t('Bold', 'عريض')}</label>
                  </div>

                  {/* Mega dropdown */}
                  <label className="flex items-center gap-2 border-t border-border pt-3 text-sm font-medium text-foreground">
                    <input type="checkbox" checked={!!it.mega} onChange={(e) => toggleMega(it, e.target.checked)} />
                    {t('Has dropdown mega-menu', 'له قائمة منسدلة')}
                  </label>
                  {it.mega && (
                    <MegaEditor item={it} t={t} onColumns={(cols) => updColumns(it, cols)} onPromo={(p) => setItem(it.id, { mega: { columns: it.mega!.columns, promo: p } })} />
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {pending ? t('Saving…', 'جارٍ الحفظ…') : t('Save changes', 'حفظ التغييرات')}
          </button>
          <button type="button" onClick={reset} disabled={pending} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface">{t('Reset to default', 'إعادة للافتراضي')}</button>
          {status && <span className="text-sm text-primary">{status}</span>}
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <h2 className="mb-2 text-sm font-semibold text-foreground">{t('Preview', 'المعاينة')}</h2>
        <NavPreview cfg={cfg} t={t} />
        <p className="mt-2 text-xs text-muted-foreground">{t('Approximate — hover an item with a dropdown to preview it.', 'تقريبي — مرّر على عنصر بقائمة لمعاينتها.')}</p>
      </aside>
    </div>
  );
}

function blankPromo(): NavMegaPromo {
  return { enabled: true, eyebrowEn: '', eyebrowAr: '', titleEn: '', titleAr: '', ctaEn: '', ctaAr: '', href: '/' };
}

function MegaEditor({ item, t, onColumns, onPromo }: { item: NavItem; t: Pick2; onColumns: (c: NavMegaColumn[]) => void; onPromo: (p: NavMegaPromo | null) => void }) {
  const mega = item.mega!;
  const cols = mega.columns;
  const setCol = (id: string, patch: Partial<NavMegaColumn>) => onColumns(cols.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const setLink = (colId: string, linkId: string, patch: Partial<NavMegaLink>) =>
    setCol(colId, { links: cols.find((c) => c.id === colId)!.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)) });
  const promo = mega.promo;

  return (
    <div className="space-y-3 rounded-lg bg-surface p-3">
      {cols.map((c) => (
        <div key={c.id} className="rounded-md border border-border bg-card p-2.5">
          <div className="mb-2 flex items-center gap-2">
            <input value={c.headingEn} onChange={(e) => setCol(c.id, { headingEn: e.target.value })} placeholder={t('Column heading (EN)', 'عنوان العمود')} className={`${inputCls} flex-1`} />
            <input value={c.headingAr} dir="rtl" onChange={(e) => setCol(c.id, { headingAr: e.target.value })} placeholder="(AR)" className={`${inputCls} flex-1`} />
            <button type="button" onClick={() => onColumns(cols.filter((x) => x.id !== c.id))} className={`${iconBtn} text-destructive`}><Icon name="x" size={13} /></button>
          </div>
          <div className="space-y-1.5">
            {c.links.map((l) => (
              <div key={l.id} className="flex items-center gap-1.5">
                <input value={l.labelEn} onChange={(e) => setLink(c.id, l.id, { labelEn: e.target.value })} placeholder="Label EN" className={`${inputCls} flex-1 text-xs`} />
                <input value={l.labelAr} dir="rtl" onChange={(e) => setLink(c.id, l.id, { labelAr: e.target.value })} placeholder="AR" className={`${inputCls} w-24 text-xs`} />
                <input value={l.href} onChange={(e) => setLink(c.id, l.id, { href: e.target.value })} placeholder="/link" className={`${inputCls} w-28 text-xs`} />
                <button type="button" onClick={() => setCol(c.id, { links: c.links.filter((x) => x.id !== l.id) })} className={`${iconBtn} text-destructive`}><Icon name="x" size={12} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setCol(c.id, { links: [...c.links, { id: uid('lnk'), labelEn: 'Link', labelAr: '', href: '/' }] })} className={btn}>+ {t('Link', 'رابط')}</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onColumns([...cols, { id: uid('col'), headingEn: 'Column', headingAr: '', links: [] }])} className={btn}>+ {t('Column', 'عمود')}</button>

      {/* Promo card */}
      <label className="flex items-center gap-2 border-t border-border pt-2 text-xs font-medium text-foreground">
        <input type="checkbox" checked={!!promo?.enabled} onChange={(e) => onPromo(e.target.checked ? { ...(promo ?? blankPromo()), enabled: true } : promo ? { ...promo, enabled: false } : null)} />
        {t('Show promo card', 'إظهار بطاقة عرض')}
      </label>
      {promo?.enabled && (
        <div className="grid gap-1.5">
          <input value={promo.eyebrowEn} onChange={(e) => onPromo({ ...promo, eyebrowEn: e.target.value })} placeholder={t('Eyebrow', 'تمهيد')} className={`${inputCls} text-xs`} />
          <input value={promo.titleEn} onChange={(e) => onPromo({ ...promo, titleEn: e.target.value })} placeholder={t('Title', 'العنوان')} className={`${inputCls} text-xs`} />
          <div className="flex gap-1.5">
            <input value={promo.ctaEn} onChange={(e) => onPromo({ ...promo, ctaEn: e.target.value })} placeholder={t('CTA', 'زر')} className={`${inputCls} flex-1 text-xs`} />
            <input value={promo.href} onChange={(e) => onPromo({ ...promo, href: e.target.value })} placeholder="/refill" className={`${inputCls} w-28 text-xs`} />
          </div>
          <input value={promo.eyebrowAr} dir="rtl" onChange={(e) => onPromo({ ...promo, eyebrowAr: e.target.value })} placeholder={t('Eyebrow (AR)', 'تمهيد (عربي)')} className={`${inputCls} text-xs`} />
          <input value={promo.titleAr} dir="rtl" onChange={(e) => onPromo({ ...promo, titleAr: e.target.value })} placeholder={t('Title (AR)', 'العنوان (عربي)')} className={`${inputCls} text-xs`} />
          <input value={promo.ctaAr} dir="rtl" onChange={(e) => onPromo({ ...promo, ctaAr: e.target.value })} placeholder={t('CTA (AR)', 'زر (عربي)')} className={`${inputCls} text-xs`} />
        </div>
      )}
    </div>
  );
}

function NavPreview({ cfg, t }: { cfg: NavConfig; t: Pick2 }) {
  return (
    <div className="overflow-hidden rounded-lg" style={{ background: 'var(--nav-preview-bg, #235C3C)' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3" style={{ fontFamily: cfg.fontFamily || undefined }}>
        {cfg.items.filter((i) => i.visible).map((i) => (
          <span key={i.id} className="inline-flex items-center gap-1" style={{ color: i.color || cfg.baseColor, fontSize: `${i.sizePx ?? cfg.baseSizePx}px`, fontWeight: i.bold ? 700 : 500 }}>
            {i.icon && <Icon name={i.icon} size={14} color={i.color || cfg.baseColor} />}
            {t(i.labelEn, i.labelAr)}
            {i.mega && <Icon name="chevron-down" size={12} color={i.color || cfg.baseColor} />}
          </span>
        ))}
        {cfg.promo.enabled && (
          <span className="ms-auto font-bold" style={{ color: cfg.promo.color, fontSize: `${cfg.baseSizePx}px` }}>{t(cfg.promo.textEn, cfg.promo.textAr)}</span>
        )}
      </div>
    </div>
  );
}
