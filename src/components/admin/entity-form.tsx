'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { SingleImageUploader } from './image-uploader';
import { RichTextField } from './rich-text/field';
import { SlugField } from './slug-field';

export type FieldSpec =
  | { name: string; label: string; type: 'text' | 'textarea' | 'slug'; required?: boolean; hint?: string }
  | { name: string; label: string; type: 'rich'; compact?: boolean; hint?: string }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[]; required?: boolean }
  | { name: string; label: string; type: 'checkbox' }
  | { name: string; label: string; type: 'image'; hint?: string }
  | { name: string; label: string; type: 'multiselect'; options: { value: string; label: string }[] };

type Action = (prev: AdminFormState, fd: FormData) => Promise<AdminFormState>;

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
            <Field key={f.name} label={f.label} required={'required' in f && f.required === true}>
              <textarea name={f.name} defaultValue={(def as string) ?? ''} rows={4} className={inputCls} />
            </Field>
          );
        }
        if (f.type === 'rich') {
          return (
            <Field key={f.name} label={f.label} required={'required' in f && f.required === true} hint={f.hint}>
              <RichTextField name={f.name} initial={(def as string) ?? ''} compact={f.compact} />
            </Field>
          );
        }
        if (f.type === 'select') {
          return (
            <Field key={f.name} label={f.label} required={'required' in f && f.required === true}>
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
            <Field key={f.name} label={f.label} required={'required' in f && f.required === true} hint="Hold Ctrl/Cmd to select multiple.">
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
            <Field key={f.name} label={f.label} required={'required' in f && f.required === true} hint={f.hint}>
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
          <Field key={f.name} label={f.label} required={'required' in f && f.required === true} hint={f.hint}>
            <input
              type="text"
              name={f.name}
              value={vals[f.name] ?? ''}
              onChange={(e) => set(f.name, e.target.value)}
              required={'required' in f && f.required === true}
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
