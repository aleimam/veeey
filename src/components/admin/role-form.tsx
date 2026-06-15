'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveRoleAction } from '@/server/staff-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

type PermOpt = { key: string; description: string };

export function RoleForm({
  id,
  locale,
  permissions,
  defaults = {},
}: {
  id?: string;
  locale: string;
  permissions: PermOpt[];
  defaults?: { key?: string; name?: string; description?: string | null; permissionKeys?: string[] };
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveRoleAction, {});
  const tb = pick(useLocale());
  const checked = new Set(defaults.permissionKeys ?? []);

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tb('Key', 'الكود')} hint={tb('Stable identifier, e.g. operations.', 'معرّف ثابت، مثل operations.')}>
          <input name="key" required defaultValue={defaults.key ?? ''} className={inputCls} />
        </Field>
        <Field label={tb('Name', 'الاسم')}>
          <input name="name" required defaultValue={defaults.name ?? ''} className={inputCls} />
        </Field>
      </div>
      <Field label={tb('Description', 'الوصف')}>
        <input name="description" defaultValue={defaults.description ?? ''} className={inputCls} />
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">{tb('Permissions', 'الصلاحيات')}</legend>
        <div className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-2">
          {permissions.map((p) => (
            <label key={p.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="permissions" value={p.key} defaultChecked={checked.has(p.key)} className="mt-1" />
              <span><span className="font-medium">{p.key}</span> <span className="text-muted-foreground">— {p.description}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <SubmitButton>{id ? tb('Save role', 'حفظ الدور') : tb('Create role', 'إنشاء دور')}</SubmitButton>
        <Link href="/admin/roles" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
