'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { pick } from '@/lib/admin-i18n';

export type CategoryOpt = { value: string; label: string; parentId: string | null };

/**
 * Nested category picker (#B5). Renders the category tree as indented checkboxes
 * and enforces a max selection (default 4). Selected ids submit as hidden
 * `categoryIds` inputs.
 */
export function CategoryPicker({ categories, initial = [], max = 4 }: { categories: CategoryOpt[]; initial?: string[]; max?: number }) {
  const tb = pick(useLocale());
  const [sel, setSel] = useState<string[]>(initial);
  const atMax = sel.length >= max;

  const byParent = new Map<string | null, CategoryOpt[]>();
  for (const c of categories) {
    const arr = byParent.get(c.parentId) ?? [];
    arr.push(c);
    byParent.set(c.parentId, arr);
  }
  const rows: { c: CategoryOpt; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      rows.push({ c, depth });
      walk(c.value, depth + 1);
    }
  };
  walk(null, 0);

  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= max ? s : [...s, id]));

  return (
    <div>
      {sel.map((id) => <input key={id} type="hidden" name="categoryIds" value={id} />)}
      <div className="max-h-56 overflow-auto rounded-md border border-border p-2 text-sm">
        {rows.map(({ c, depth }) => {
          const checked = sel.includes(c.value);
          return (
            <label key={c.value} className="flex items-center gap-2 py-0.5" style={{ paddingInlineStart: depth * 16 }}>
              <input type="checkbox" checked={checked} disabled={!checked && atMax} onChange={() => toggle(c.value)} className="size-3.5" />
              <span className={!checked && atMax ? 'text-muted-foreground' : ''}>{c.label}</span>
            </label>
          );
        })}
        {rows.length === 0 && <p className="text-muted-foreground">{tb('No categories yet.', 'لا توجد فئات بعد.')}</p>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{tb(`Selected ${sel.length} of ${max} max.`, `محدد ${sel.length} من ${max} كحد أقصى.`)}</p>
    </div>
  );
}
