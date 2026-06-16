'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';
import { translateFieldsAction } from '@/server/quick-actions';

/**
 * "Translate to Arabic" button (#D1). Reads the English inputs named in `pairs`
 * from the enclosing form, sends them to the AI, and fills the matching Arabic
 * inputs. Staff can then edit. Uncontrolled inputs are written by DOM value so
 * they submit normally. No-op (with a hint) when AI is off.
 */
export function TranslateButton({ pairs }: { pairs: { en: string; ar: string }[] }) {
  const tb = pick(useLocale());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest('form');
    if (!form) return;
    const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement | null;
    const en: Record<string, string> = {};
    for (const p of pairs) {
      const el = field(p.en);
      if (el && el.value.trim()) en[p.en] = el.value;
    }
    if (Object.keys(en).length === 0) {
      setMsg(tb('Fill the English fields first.', 'املأ الحقول الإنجليزية أولًا.'));
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const out = await translateFieldsAction(en);
      if (!out) {
        setMsg(tb('AI is off — configure it in Providers.', 'الذكاء الاصطناعي غير مُفعّل — فعّله في المزوّدين.'));
        return;
      }
      let filled = 0;
      for (const p of pairs) {
        const v = out[p.en];
        const el = field(p.ar);
        if (v && el) { el.value = v; filled++; }
      }
      setMsg(tb(`Filled ${filled} field(s) — review & edit.`, `تم ملء ${filled} حقلًا — راجع وعدّل.`));
    } catch {
      setMsg(tb('Translation failed.', 'فشلت الترجمة.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={run} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50">
        {busy ? tb('Translating…', 'جارٍ الترجمة…') : tb('✦ Translate to Arabic', '✦ ترجمة إلى العربية')}
      </button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
