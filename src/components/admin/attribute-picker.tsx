'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { inputCls } from './ui';
import { quickCreateAttribute, quickCreateAttributeValue } from '@/server/quick-actions';

export type AttrOpt = { id: string; label: string; kind: string; values: { id: string; label: string }[] };

/**
 * Attributes one-by-one (#C3): pick an attribute, then one of its values, then
 * Add. New attributes/values can be created inline (#C2). Attributes are filtered
 * to the current product kind. Chosen value ids submit as hidden
 * `attributeValueIds` inputs.
 */
export function AttributePicker({ attributes, initial = [], kind }: { attributes: AttrOpt[]; initial?: string[]; kind: string }) {
  const tb = pick(useLocale());
  const [attrs, setAttrs] = useState<AttrOpt[]>(attributes);
  const [selected, setSelected] = useState<string[]>(initial);
  const [attrId, setAttrId] = useState('');
  const [valId, setValId] = useState('');
  const [newAttr, setNewAttr] = useState('');
  const [newVal, setNewVal] = useState('');
  const [busy, setBusy] = useState(false);

  const shown = attrs.filter((a) => a.kind === kind);
  const curAttr = attrs.find((a) => a.id === attrId);
  const valueMeta = (vid: string) => {
    for (const a of attrs) {
      const v = a.values.find((x) => x.id === vid);
      if (v) return { attr: a.label, val: v.label };
    }
    return null;
  };

  const add = () => {
    if (valId && !selected.includes(valId)) setSelected((s) => [...s, valId]);
    setValId('');
  };
  const remove = (vid: string) => setSelected((s) => s.filter((x) => x !== vid));

  async function createAttr() {
    if (!newAttr.trim()) return;
    setBusy(true);
    try {
      const a = await quickCreateAttribute(newAttr.trim(), (kind as 'SUPPLEMENT' | 'DEVICE' | 'INJECTION'));
      setAttrs((list) => [...list, { id: a.id, label: a.label, kind, values: [] }]);
      setAttrId(a.id);
      setNewAttr('');
    } finally {
      setBusy(false);
    }
  }
  async function createVal() {
    if (!curAttr || !newVal.trim()) return;
    setBusy(true);
    try {
      const v = await quickCreateAttributeValue(curAttr.id, newVal.trim());
      setAttrs((list) => list.map((a) => (a.id === curAttr.id ? { ...a, values: [...a.values, { id: v.id, label: v.label }] } : a)));
      setValId(v.id);
      setNewVal('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {selected.map((vid) => <input key={vid} type="hidden" name="attributeValueIds" value={vid} />)}

      <div className="flex flex-wrap items-end gap-2">
        <select value={attrId} onChange={(e) => { setAttrId(e.target.value); setValId(''); }} className={`${inputCls} w-40`}>
          <option value="">{tb('Attribute…', 'الخاصية…')}</option>
          {shown.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select value={valId} onChange={(e) => setValId(e.target.value)} disabled={!curAttr} className={`${inputCls} w-40`}>
          <option value="">{tb('Value…', 'القيمة…')}</option>
          {curAttr?.values.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <button type="button" onClick={add} disabled={!valId} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-surface disabled:opacity-50">{tb('Add', 'إضافة')}</button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <input value={newAttr} onChange={(e) => setNewAttr(e.target.value)} placeholder={tb('New attribute', 'خاصية جديدة')} className={`${inputCls} w-36 py-1`} />
        <button type="button" onClick={createAttr} disabled={busy || !newAttr.trim()} className="text-primary hover:underline disabled:opacity-50">{tb('+ attribute', '+ خاصية')}</button>
        {curAttr && (
          <>
            <input value={newVal} onChange={(e) => setNewVal(e.target.value)} placeholder={tb('New value', 'قيمة جديدة')} className={`${inputCls} w-36 py-1`} />
            <button type="button" onClick={createVal} disabled={busy || !newVal.trim()} className="text-primary hover:underline disabled:opacity-50">{tb('+ value', '+ قيمة')}</button>
          </>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((vid) => {
            const m = valueMeta(vid);
            return (
              <span key={vid} className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-xs">
                {m ? `${m.attr}: ${m.val}` : vid}
                <button type="button" onClick={() => remove(vid)} className="text-destructive" aria-label={tb('Remove', 'إزالة')}>×</button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
