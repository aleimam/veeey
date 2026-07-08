'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveDepartmentAction } from '@/server/staff-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

type PermOpt = { key: string; description: string };

/** Department editor (TEAM epic): key + bilingual name + editable permission set. */
export function DepartmentForm({
  id,
  locale,
  permissions,
  defaults = {},
}: {
  id?: string;
  locale: string;
  permissions: PermOpt[];
  defaults?: { key?: string; nameEn?: string; nameAr?: string | null; description?: string | null; permissionKeys?: string[] };
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveDepartmentAction, {});
  const tb = pick(useLocale());
  const checked = new Set(defaults.permissionKeys ?? []);

  return (
    <form action={action} className="max-w-2xl space-y-5">
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
        <legend className="mb-2 text-sm font-medium text-foreground">{tb('Permissions (members inherit the UNION of all their departments)', 'الصلاحيات (يحصل الأعضاء على اتحاد صلاحيات كل أقسامهم)')}</legend>
        <div className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-2">
          {permissions.map((p) => (
            <label key={p.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="permissions" value={p.key} defaultChecked={checked.has(p.key)} className="mt-1" />
              <span><span className="font-medium">{p.key}</span> <span className="text-muted-foreground">— {p.description}</span></span>
            </label>
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
