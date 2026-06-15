'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';

export type FieldSpec =
  | { name: string; label: string; type: 'text' | 'textarea' | 'slug'; required?: boolean; hint?: string }
  | { name: string; label: string; type: 'select'; options: { value: string; label: string }[]; required?: boolean }
  | { name: string; label: string; type: 'checkbox' }
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
}: {
  action: Action;
  fields: FieldSpec[];
  defaults?: Record<string, unknown>;
  id?: string;
  locale: string;
  listHref: string;
}) {
  const [state, formAction] = useActionState<AdminFormState, FormData>(action, {});
  const tc = useTranslations('admin.common');

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      {fields.map((f) => {
        const def = defaults[f.name];
        if (f.type === 'textarea') {
          return (
            <Field key={f.name} label={f.label}>
              <textarea name={f.name} defaultValue={(def as string) ?? ''} rows={4} className={inputCls} />
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
        if (f.type === 'checkbox') {
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name={f.name} defaultChecked={!!def} className="size-4" />
              {f.label}
            </label>
          );
        }
        // text / slug
        return (
          <Field key={f.name} label={f.label} hint={f.type === 'slug' ? 'Leave blank to auto-generate.' : f.hint}>
            <input
              type="text"
              name={f.name}
              defaultValue={(def as string) ?? ''}
              required={'required' in f ? f.required : false}
              className={inputCls}
            />
          </Field>
        );
      })}

      <div className="flex items-center gap-3 pt-2">
        <SubmitButton />
        <Link href={listHref} className="text-sm text-muted-foreground hover:underline">
          {tc('cancel')}
        </Link>
      </div>
    </form>
  );
}
