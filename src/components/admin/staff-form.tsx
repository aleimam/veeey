'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveStaffAction } from '@/server/staff-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

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
  const tb = pick(useLocale());

  return (
    <form action={action} className="max-w-xl space-y-5">
      <FormError error={state.error} />
      <input type="hidden" name="locale" value={locale} />
      {id && <input type="hidden" name="id" value={id} />}

      <Field label={tb('Full name', 'الاسم الكامل')}>
        <input name="name" required defaultValue={defaults.name ?? ''} className={inputCls} />
      </Field>

      {id ? (
        <Field label={tb('Email', 'البريد الإلكتروني')}>
          <input value={defaults.email ?? ''} disabled className={`${inputCls} opacity-60`} />
        </Field>
      ) : (
        <Field label={tb('Email', 'البريد الإلكتروني')}>
          <input name="email" type="email" required defaultValue="" className={inputCls} />
        </Field>
      )}

      <Field label={tb('Role', 'الدور')}>
        <select name="roleId" required defaultValue={defaults.roleId ?? ''} className={inputCls}>
          <option value="" disabled>{tb('Choose a role…', 'اختر دورًا…')}</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>

      <Field label={id ? tb('New password', 'كلمة مرور جديدة') : tb('Password', 'كلمة المرور')} hint={id ? tb('Leave empty to keep the current password.', 'اتركها فارغة للإبقاء على كلمة المرور الحالية.') : tb('At least 8 characters.', '8 أحرف على الأقل.')}>
        <input name="password" type="password" minLength={8} required={!id} autoComplete="new-password" className={inputCls} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{id ? tb('Save changes', 'حفظ التغييرات') : tb('Create user', 'إنشاء مستخدم')}</SubmitButton>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">{tb('Cancel', 'إلغاء')}</Link>
      </div>
    </form>
  );
}
