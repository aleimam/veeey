'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { AdminFormState } from '@/server/admin-actions';
import { slugify } from '@/lib/sku';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { SingleImageUploader } from './image-uploader';
import { RichTextField } from './rich-text/field';

export type FieldSpec =
  | { name: string; label: string; type: 'text' | 'textarea' | 'slug'; required?: boolean; hint?: string }
  | { name: string; label: string; type: 'rich'; compact?: boolean; hint?: string }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[]; required?: boolean }
  | { name: string; label: string; type: 'checkbox' }
  | { name: string; label: string; type: 'image'; hint?: string }
  | { name: string; label: string; type: 'multiselect'; options: { value: string; label: string }[] };

type Action = (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;

/** Slug input with live preview (from the English name), invalid-char validation
 *  and a debounced duplicate check (when `entity` is given). */
function SlugField({ fieldName, label, value, onChange, sourceName, entity, id }: {
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

/** Generic admin create/edit form driven by a field spec (used by all the
 *  simpler bilingual entities — brand/category/tag/attribute/page/post/collection). */
export function EntityForm({
  action,
  fields,
  defaults = {},
  id,
  locale,
  listHref,
  extra,
  slugEntity,
}: {
  action: Action;
  fields: FieldSpec[];
  defaults?: Record<string, unknown>;
  id?: string;
  locale: string;
  listHref: string;
  /** Rendered inside the form before the submit row (e.g. the SEO module). */
  extra?: React.ReactNode;
  /** Enables the live duplicate-slug check for this entity (e.g. "tag"). */
  slugEntity?: string;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(action, {});
  const tc = useTranslations('admin.common');
  const router = useRouter();
  const hasFullRich = fields.some((f) => f.type === 'rich' && !f.compact);

  // Controlled state for text/slug fields (so the slug can preview from the name);
  // other field types stay uncontrolled (defaultValue).
  const textNames = fields.filter((f) => f.type === 'text' || f.type === 'slug').map((f) => f.name);
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(textNames.map((n) => [n, (defaults[n] as string) ?? ''])),
  );
  const [dirty, setDirty] = useState(false);
  const set = (n: string, v: string) => { setVals((p) => ({ ...p, [n]: v })); setDirty(true); };
  const sourceName = vals['nameEn'] ?? vals['titleEn'] ?? '';

  // Warn before leaving with unsaved edits on a HARD unload (reload / tab close /
  // external nav). A successful save redirects via a client-side navigation,
  // which doesn't fire beforeunload, so no guard is needed there; Cancel (client
  // nav) is guarded on the button.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const cancel = () => {
    if (dirty && !confirm(tc('unsavedLeave'))) return;
    router.push(listHref);
  };

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      className={`${hasFullRich ? 'max-w-4xl' : 'max-w-2xl'} space-y-5`}
    >
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      {fields.map((f) => {
        const def = defaults[f.name];
        if (f.type === 'slug') {
          return <SlugField key={f.name} fieldName={f.name} label={f.label} value={vals[f.name] ?? ''} onChange={(v) => set(f.name, v)} sourceName={sourceName} entity={slugEntity} id={id} />;
        }
        if (f.type === 'textarea') {
          return (
            <Field key={f.name} label={f.label}>
              <textarea name={f.name} defaultValue={(def as string) ?? ''} rows={4} className={inputCls} />
            </Field>
          );
        }
        if (f.type === 'rich') {
          return (
            <Field key={f.name} label={f.label} hint={f.hint}>
              <RichTextField name={f.name} initial={(def as string) ?? ''} compact={f.compact} />
            </Field>
          );
        }
        if (f.type === 'select') {
          return (
            <Field key={f.name} label={f.label}>
              <select name={f.name} defaultValue={(def as string) ?? ''} className={inputCls}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          );
        }
        if (f.type === 'multiselect') {
          const selected = new Set((def as string[]) ?? []);
          return (
            <Field key={f.name} label={f.label} hint="Hold Ctrl/Cmd to select multiple.">
              <select name={f.name} multiple defaultValue={[...selected]} className={`${inputCls} h-40`}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          );
        }
        if (f.type === 'image') {
          return (
            <Field key={f.name} label={f.label} hint={f.hint}>
              <SingleImageUploader name={f.name} initial={(def as string) ?? ''} />
            </Field>
          );
        }
        if (f.type === 'checkbox') {
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name={f.name} defaultChecked={!!def} className="size-4" />
              {f.label}
            </label>
          );
        }
        // text (controlled so the slug preview can read the name)
        return (
          <Field key={f.name} label={f.label} hint={f.hint}>
            <input
              type="text"
              name={f.name}
              value={vals[f.name] ?? ''}
              onChange={(e) => set(f.name, e.target.value)}
              required={'required' in f ? f.required : false}
              className={inputCls}
            />
          </Field>
        );
      })}

      {extra}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <button type="button" onClick={cancel} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
