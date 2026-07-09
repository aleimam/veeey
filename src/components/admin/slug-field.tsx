'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { slugify } from '@/lib/sku';
import { Field, inputCls } from './ui';

/** Slug input with live preview (from a source name), invalid-char validation
 *  and a debounced duplicate check (when `entity` is given). Shared by the
 *  generic EntityForm and the bespoke CollectionForm. */
export function SlugField({ fieldName, label, value, onChange, sourceName, entity, id }: {
  fieldName: string; label: string; value: string; onChange: (v: string) => void; sourceName: string; entity?: string; id?: string;
}) {
  const tc = useTranslations('admin.common');
  const [taken, setTaken] = useState(false);
  const effective = value.trim() || slugify(sourceName); // what will actually be saved
  const invalid = value.trim() !== '' && value.trim() !== slugify(value);

  useEffect(() => {
    let alive = true;
    // All setState happens inside the debounce callback (never synchronously in
    // the effect body) so the check is throttled and lint-clean.
    const t = setTimeout(async () => {
      if (!entity || !effective) { if (alive) setTaken(false); return; }
      try {
        const params = new URLSearchParams({ entity, slug: effective, ...(id ? { id } : {}) });
        const r = await fetch(`/api/admin/slug-available?${params}`);
        const j = await r.json();
        if (alive) setTaken(j?.available === false);
      } catch { if (alive) setTaken(false); }
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [entity, effective, id]);

  return (
    <Field label={label} hint={tc('slugAutoHint')}>
      <input type="text" name={fieldName} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} dir="ltr" />
      {invalid && (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          {tc('slugInvalid', { slug: slugify(value) })}{' '}
          <button type="button" onClick={() => onChange(slugify(value))} className="font-medium underline">{tc('slugUse')}</button>
        </p>
      )}
      {!invalid && effective && (
        <p className="mt-1 text-xs text-muted-foreground"><span className="font-mono">{tc('slugPreview', { slug: effective })}</span></p>
      )}
      {taken && !invalid && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{tc('slugTaken')}</p>}
    </Field>
  );
}
