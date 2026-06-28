'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { inputCls, SubmitButton } from './ui';
import { RichTextEditor } from './rich-text/editor';
import { saveHomeLayoutAction } from '@/server/home-actions';
import {
  BLOCK_META, GADGET_TYPES, defaultProps, isGadget,
  moveBlock, toggleBlock, removeBlock, type Block, type GadgetType,
} from '@/lib/home-layout';

type Coll = { id: string; title: string };
type Tb = (en: string, ar: string) => string;

async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('upload failed');
  return ((await res.json()) as { url: string }).url;
}

function newId(): string {
  try { return `g-${crypto.randomUUID().slice(0, 8)}`; } catch { return `g-${Math.round(performance.now())}`; }
}

function ImgField({ value, onChange, label, tb }: { value: string; onChange: (v: string) => void; label: string; tb: Tb }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value && <img src={value} alt="" className="size-12 rounded-md border border-border object-cover" />}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setBusy(true); try { onChange(await uploadImage(f)); } finally { setBusy(false); } }}
          className="text-xs"
        />
        {value && <button type="button" onClick={() => onChange('')} className="text-xs text-destructive hover:underline">{tb('Remove', 'إزالة')}</button>}
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… / /uploads/…" className={`${inputCls} mt-1`} />
    </div>
  );
}

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-sm font-medium">{children}</span>;
const Row = ({ children }: { children: React.ReactNode }) => <div className="grid gap-3 sm:grid-cols-2">{children}</div>;

function GadgetEditor({ block, setProp, collections, tb }: { block: Block; setProp: (k: string, v: unknown) => void; collections: Coll[]; tb: Tb }) {
  const p = (block.props ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');

  if (block.type === 'rich') {
    return (
      <div className="space-y-4">
        <div>
          <Lbl>{tb('Content (English)', 'المحتوى (إنجليزي)')}</Lbl>
          <RichTextEditor value={str('htmlEn')} onChange={(h) => setProp('htmlEn', h)} uploadImage={uploadImage} placeholder={tb('Write…', 'اكتب…')} />
        </div>
        <div>
          <Lbl>{tb('Content (Arabic)', 'المحتوى (عربي)')}</Lbl>
          <RichTextEditor value={str('htmlAr')} onChange={(h) => setProp('htmlAr', h)} uploadImage={uploadImage} dir="rtl" placeholder={tb('اكتب…', 'اكتب…')} />
        </div>
        <label className="block text-sm">
          <Lbl>{tb('Width', 'العرض')}</Lbl>
          <select value={str('width') || 'wide'} onChange={(e) => setProp('width', e.target.value)} className={inputCls}>
            <option value="wide">{tb('Full width', 'عرض كامل')}</option>
            <option value="narrow">{tb('Narrow (article)', 'ضيّق (مقال)')}</option>
          </select>
        </label>
      </div>
    );
  }

  if (block.type === 'image-banner') {
    return (
      <div className="space-y-3">
        <ImgField value={str('imageUrl')} onChange={(v) => setProp('imageUrl', v)} label={tb('Banner image', 'صورة البانر')} tb={tb} />
        <Row>
          <label><Lbl>{tb('Heading (EN)', 'العنوان (إنجليزي)')}</Lbl><input value={str('headingEn')} onChange={(e) => setProp('headingEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Heading (AR)', 'العنوان (عربي)')}</Lbl><input value={str('headingAr')} onChange={(e) => setProp('headingAr', e.target.value)} dir="rtl" className={inputCls} /></label>
          <label><Lbl>{tb('Text (EN)', 'النص (إنجليزي)')}</Lbl><input value={str('textEn')} onChange={(e) => setProp('textEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Text (AR)', 'النص (عربي)')}</Lbl><input value={str('textAr')} onChange={(e) => setProp('textAr', e.target.value)} dir="rtl" className={inputCls} /></label>
          <label><Lbl>{tb('Button label (EN)', 'زر (إنجليزي)')}</Lbl><input value={str('ctaLabelEn')} onChange={(e) => setProp('ctaLabelEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Button label (AR)', 'زر (عربي)')}</Lbl><input value={str('ctaLabelAr')} onChange={(e) => setProp('ctaLabelAr', e.target.value)} dir="rtl" className={inputCls} /></label>
        </Row>
        <label className="block"><Lbl>{tb('Link (href)', 'الرابط')}</Lbl><input value={str('href')} onChange={(e) => setProp('href', e.target.value)} placeholder="/products" className={inputCls} /></label>
      </div>
    );
  }

  if (block.type === 'product-row') {
    const source = str('source') || 'bestsellers';
    return (
      <div className="space-y-3">
        <Row>
          <label><Lbl>{tb('Title (EN)', 'العنوان (إنجليزي)')}</Lbl><input value={str('titleEn')} onChange={(e) => setProp('titleEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Title (AR)', 'العنوان (عربي)')}</Lbl><input value={str('titleAr')} onChange={(e) => setProp('titleAr', e.target.value)} dir="rtl" className={inputCls} /></label>
        </Row>
        <Row>
          <label><Lbl>{tb('Source', 'المصدر')}</Lbl>
            <select value={source} onChange={(e) => setProp('source', e.target.value)} className={inputCls}>
              <option value="bestsellers">{tb('Best sellers', 'الأكثر مبيعًا')}</option>
              <option value="deals">{tb('Expiry deals', 'عروض الصلاحية')}</option>
              <option value="new">{tb('New arrivals', 'وصل حديثًا')}</option>
              <option value="collection">{tb('Collection', 'مجموعة')}</option>
            </select>
          </label>
          {source === 'collection' && (
            <label><Lbl>{tb('Collection', 'المجموعة')}</Lbl>
              <select value={str('collectionId')} onChange={(e) => setProp('collectionId', e.target.value)} className={inputCls}>
                <option value="">{tb('— Choose —', '— اختر —')}</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
          )}
          <label><Lbl>{tb('How many', 'كم عدد')}</Lbl><input type="number" min="1" max="12" value={Number(p.limit) || 5} onChange={(e) => setProp('limit', Number(e.target.value))} className={inputCls} /></label>
          <label><Lbl>{tb('"View all" link', 'رابط "عرض الكل"')}</Lbl><input value={str('actionHref')} onChange={(e) => setProp('actionHref', e.target.value)} placeholder="/products" className={inputCls} /></label>
        </Row>
      </div>
    );
  }

  if (block.type === 'cta') {
    return (
      <div className="space-y-3">
        <Row>
          <label><Lbl>{tb('Heading (EN)', 'العنوان (إنجليزي)')}</Lbl><input value={str('headingEn')} onChange={(e) => setProp('headingEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Heading (AR)', 'العنوان (عربي)')}</Lbl><input value={str('headingAr')} onChange={(e) => setProp('headingAr', e.target.value)} dir="rtl" className={inputCls} /></label>
          <label><Lbl>{tb('Text (EN)', 'النص (إنجليزي)')}</Lbl><input value={str('textEn')} onChange={(e) => setProp('textEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Text (AR)', 'النص (عربي)')}</Lbl><input value={str('textAr')} onChange={(e) => setProp('textAr', e.target.value)} dir="rtl" className={inputCls} /></label>
          <label><Lbl>{tb('Button (EN)', 'زر (إنجليزي)')}</Lbl><input value={str('ctaLabelEn')} onChange={(e) => setProp('ctaLabelEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Button (AR)', 'زر (عربي)')}</Lbl><input value={str('ctaLabelAr')} onChange={(e) => setProp('ctaLabelAr', e.target.value)} dir="rtl" className={inputCls} /></label>
        </Row>
        <Row>
          <label><Lbl>{tb('Link (href)', 'الرابط')}</Lbl><input value={str('href')} onChange={(e) => setProp('href', e.target.value)} placeholder="/select" className={inputCls} /></label>
          <label><Lbl>{tb('Background', 'الخلفية')}</Lbl>
            <select value={str('bg') || 'green'} onChange={(e) => setProp('bg', e.target.value)} className={inputCls}>
              <option value="green">{tb('Emerald', 'زمردي')}</option>
              <option value="dark">{tb('Dark', 'داكن')}</option>
              <option value="light">{tb('Light wash', 'فاتح')}</option>
            </select>
          </label>
        </Row>
      </div>
    );
  }

  if (block.type === 'tiles') {
    type Tile = { labelEn?: string; labelAr?: string; href?: string; imageUrl?: string };
    const tiles = (Array.isArray(p.tiles) ? p.tiles : []) as Tile[];
    const setTiles = (next: Tile[]) => setProp('tiles', next);
    const upd = (i: number, k: keyof Tile, v: string) => setTiles(tiles.map((t, j) => (i === j ? { ...t, [k]: v } : t)));
    return (
      <div className="space-y-3">
        <Row>
          <label><Lbl>{tb('Section title (EN)', 'عنوان القسم (إنجليزي)')}</Lbl><input value={str('titleEn')} onChange={(e) => setProp('titleEn', e.target.value)} className={inputCls} /></label>
          <label><Lbl>{tb('Section title (AR)', 'عنوان القسم (عربي)')}</Lbl><input value={str('titleAr')} onChange={(e) => setProp('titleAr', e.target.value)} dir="rtl" className={inputCls} /></label>
        </Row>
        <div className="space-y-3">
          {tiles.map((t, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{tb('Tile', 'بطاقة')} {i + 1}</span>
                <button type="button" onClick={() => setTiles(tiles.filter((_, j) => j !== i))} className="text-xs text-destructive hover:underline">{tb('Remove', 'إزالة')}</button>
              </div>
              <Row>
                <label><Lbl>{tb('Label (EN)', 'التسمية (إنجليزي)')}</Lbl><input value={t.labelEn ?? ''} onChange={(e) => upd(i, 'labelEn', e.target.value)} className={inputCls} /></label>
                <label><Lbl>{tb('Label (AR)', 'التسمية (عربي)')}</Lbl><input value={t.labelAr ?? ''} onChange={(e) => upd(i, 'labelAr', e.target.value)} dir="rtl" className={inputCls} /></label>
              </Row>
              <label className="mt-2 block"><Lbl>{tb('Link', 'الرابط')}</Lbl><input value={t.href ?? ''} onChange={(e) => upd(i, 'href', e.target.value)} placeholder="/products" className={inputCls} /></label>
              <div className="mt-2"><ImgField value={t.imageUrl ?? ''} onChange={(v) => upd(i, 'imageUrl', v)} label={tb('Icon / image (optional)', 'أيقونة / صورة (اختياري)')} tb={tb} /></div>
            </div>
          ))}
          <button type="button" onClick={() => setTiles([...tiles, {}])} className="rounded-md border border-dashed border-border px-3 py-1.5 text-sm hover:bg-surface">+ {tb('Add tile', 'إضافة بطاقة')}</button>
        </div>
      </div>
    );
  }

  return null;
}

export function HomeBuilder({ locale, initialBlocks, collections }: { locale: string; initialBlocks: Block[]; collections: Coll[] }) {
  const tb = pick(useLocale());
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const setProp = (id: string, key: string, val: unknown) =>
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, props: { ...(b.props ?? {}), [key]: val } } : b)));

  const add = (type: GadgetType) => {
    const id = newId();
    setBlocks((bs) => [...bs, { id, type, enabled: true, props: defaultProps(type) }]);
    setEditing(id);
    setAdding(false);
  };

  return (
    <form action={saveHomeLayoutAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="layout" value={JSON.stringify(blocks)} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <button type="button" onClick={() => setAdding((v) => !v)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface">+ {tb('Add gadget', 'إضافة عنصر')}</button>
          {adding && (
            <div className="absolute z-20 mt-1 w-56 rounded-md border border-border bg-card p-1 shadow-md">
              {GADGET_TYPES.map((g) => (
                <button key={g} type="button" onClick={() => add(g)} className="block w-full rounded px-2 py-1.5 text-start text-sm hover:bg-surface">{tb(BLOCK_META[g].en, BLOCK_META[g].ar)}</button>
              ))}
            </div>
          )}
        </div>
        <SubmitButton>{tb('Save homepage', 'حفظ الصفحة الرئيسية')}</SubmitButton>
      </div>

      <ol className="space-y-2">
        {blocks.map((b, i) => {
          const meta = BLOCK_META[b.type];
          const gadget = isGadget(b.type);
          return (
            <li key={b.id} className={`rounded-lg border ${b.enabled ? 'border-border' : 'border-dashed border-border opacity-60'}`}>
              <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => setBlocks((bs) => moveBlock(bs, b.id, -1))} className="px-1 text-xs leading-none text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="up">▲</button>
                  <button type="button" disabled={i === blocks.length - 1} onClick={() => setBlocks((bs) => moveBlock(bs, b.id, 1))} className="px-1 text-xs leading-none text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="down">▼</button>
                </div>
                <div className="flex-1">
                  <span className="font-medium">{tb(meta.en, meta.ar)}</span>
                  <span className={`ms-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${gadget ? 'bg-primary/10 text-primary' : 'bg-surface text-muted-foreground'}`}>{gadget ? tb('Gadget', 'عنصر') : tb('Section', 'قسم')}</span>
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={b.enabled} onChange={() => setBlocks((bs) => toggleBlock(bs, b.id))} className="size-4" />
                  {b.enabled ? tb('Shown', 'ظاهر') : tb('Hidden', 'مخفي')}
                </label>
                {gadget && <button type="button" onClick={() => setEditing((e) => (e === b.id ? null : b.id))} className="text-sm text-primary hover:underline">{editing === b.id ? tb('Close', 'إغلاق') : tb('Edit', 'تعديل')}</button>}
                {gadget && <button type="button" onClick={() => { setBlocks((bs) => removeBlock(bs, b.id)); if (editing === b.id) setEditing(null); }} className="text-sm text-destructive hover:underline">{tb('Delete', 'حذف')}</button>}
              </div>
              {gadget && editing === b.id && (
                <div className="border-t border-border p-4">
                  <GadgetEditor block={b} setProp={(k, v) => setProp(b.id, k, v)} collections={collections} tb={tb} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </form>
  );
}
