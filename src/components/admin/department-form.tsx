'use client';

import { useActionState, useRef } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveDepartmentAction } from '@/server/staff-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

type PermOpt = { key: string; description: string };
type PermGroup = { title: string; perms: PermOpt[] };

/** Department editor (TEAM epic): key + bilingual name + editable permission
 *  matrix, grouped with per-group and global select-all toggles. */
export function DepartmentForm({
  id,
  locale,
  groups,
  defaults = {},
}: {
  id?: string;
  locale: string;
  groups: PermGroup[];
  defaults?: { key?: string; nameEn?: string; nameAr?: string | null; description?: string | null; permissionKeys?: string[] };
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveDepartmentAction, {});
  const tb = pick(useLocale());
  const checked = new Set(defaults.permissionKeys ?? []);
  const formRef = useRef<HTMLFormElement>(null);

  const boxes = (filter?: string[]) =>
    Array.from(formRef.current?.querySelectorAll<HTMLInputElement>('input[name="permissions"]') ?? [])
      .filter((b) => !filter || filter.includes(b.value));
  const setAll = (on: boolean, filter?: string[]) => boxes(filter).forEach((b) => { b.checked = on; });

  return (
    <form ref={formRef} action={action} className="max-w-3xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={tb('Key', 'الكود')} hint={tb('Stable id, e.g. sales — the "sales" key powers the order handler picker.', 'معرّف ثابت مثل sales — كود «sales» يغذي قائمة مسؤول الطلب.')}>
          <input name="key" required pattern="[a-z0-9_-]+" defaultValue={defaults.key ?? ''} className={inputCls} />
        </Field>
        <Field label={tb('Name (English)', 'الاسم (بالإنجليزية)')}>
          <input name="nameEn" required defaultValue={defaults.nameEn ?? ''} className={inputCls} />
        </Field>
        <Field label={tb('Name (Arabic)', 'الاسم (بالعربية)')}>
          <input name="nameAr" dir="rtl" defaultValue={defaults.nameAr ?? ''} className={inputCls} />
        </Field>
      </div>
      <Field label={tb('Description', 'الوصف')}>
        <input name="description" defaultValue={defaults.description ?? ''} className={inputCls} />
      </Field>

      <fieldset>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-medium text-foreground">{tb('Permissions (members inherit the UNION of all their departments)', 'الصلاحيات (يحصل الأعضاء على اتحاد صلاحيات كل أقسامهم)')}</legend>
          <div className="flex gap-2 text-xs">
            <button type="button" onClick={() => setAll(true)} className="rounded-md border border-border px-2 py-1 hover:bg-surface">{tb('Select all', 'تحديد الكل')}</button>
            <button type="button" onClick={() => setAll(false)} className="rounded-md border border-border px-2 py-1 hover:bg-surface">{tb('Clear all', 'مسح الكل')}</button>
          </div>
        </div>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
                <div className="flex gap-2 text-[11px] text-muted-foreground">
                  <button type="button" onClick={() => setAll(true, g.perms.map((p) => p.key))} className="hover:text-primary hover:underline">{tb('All', 'الكل')}</button>
                  <span>·</span>
                  <button type="button" onClick={() => setAll(false, g.perms.map((p) => p.key))} className="hover:text-primary hover:underline">{tb('None', 'بدون')}</button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {g.perms.map((p) => (
                  <label key={p.key} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" name="permissions" value={p.key} defaultChecked={checked.has(p.key)} className="mt-1" />
                    <span><span className="font-medium">{p.description}</span> <span className="block text-xs text-muted-foreground">{p.key}</span></span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-muted-foreground">{tb('Permission changes apply to each member at their next sign-in.', 'تسري تغييرات الصلاحيات على كل عضو عند تسجيل دخوله التالي.')}</p>

      <div className="flex items-center gap-3">
        <SubmitButton>{id ? tb('Save department', 'حفظ القسم') : tb('Create department', 'إنشاء قسم')}</SubmitButton>
        <Link href="/admin/departments" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
