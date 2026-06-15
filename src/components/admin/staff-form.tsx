'use client';

import { useActionState } from 'react';
import { Link } from '@/i18n/navigation';
import { saveStaffAction } from '@/server/staff-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';

type RoleOpt = { id: string; name: string; key: string };

export function StaffForm({
  id,
  locale,
  roles,
  defaults = {},
}: {
  id?: string;
  locale: string;
  roles: RoleOpt[];
  defaults?: { name?: string; email?: string; roleId?: string };
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveStaffAction, {});

  return (
    <form action={action} className="max-w-xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <Field label="Full name">
        <input name="name" required defaultValue={defaults.name ?? ''} className={inputCls} />
      </Field>

      {id ? (
        <Field label="Email">
          <input value={defaults.email ?? ''} disabled className={`${inputCls} opacity-60`} />
        </Field>
      ) : (
        <Field label="Email">
          <input name="email" type="email" required defaultValue="" className={inputCls} />
        </Field>
      )}

      <Field label="Role">
        <select name="roleId" required defaultValue={defaults.roleId ?? ''} className={inputCls}>
          <option value="" disabled>Select a role…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>

      <Field label={id ? 'New password' : 'Password'} hint={id ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}>
        <input name="password" type="password" minLength={8} required={!id} autoComplete="new-password" className={inputCls} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{id ? 'Save changes' : 'Create user'}</SubmitButton>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">Cancel</Link>
      </div>
    </form>
  );
}
