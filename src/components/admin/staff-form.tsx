'use client';

import { useActionState } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { saveStaffAction } from '@/server/staff-actions';
import type { AdminFormState } from '@/server/admin-actions';
import { Field, FormError, SubmitButton, inputCls } from './ui';
import { pick } from '@/lib/admin-i18n';

type DeptOpt = { id: string; nameEn: string; nameAr?: string | null; key: string };

export function StaffForm({
  id,
  locale,
  departments,
  defaults = {},
}: {
  id?: string;
  locale: string;
  departments: DeptOpt[];
  defaults?: { name?: string; email?: string; departmentIds?: string[] };
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(saveStaffAction, {});
  const tb = pick(useLocale());
  const member = new Set(defaults.departmentIds ?? []);

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

      <Field
        label={tb('Departments', 'الأقسام')}
        hint={tb('One or many — permissions are the UNION of all selected departments (applied at next sign-in).', 'قسم واحد أو أكثر — الصلاحيات هي اتحاد صلاحيات الأقسام المختارة (تسري عند تسجيل الدخول التالي).')}
      >
        <div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          {departments.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="departmentIds" value={d.id} defaultChecked={member.has(d.id)} className="size-4" />
              {tb(d.nameEn, d.nameAr ?? d.nameEn)} <span className="font-mono text-xs text-muted-foreground">({d.key})</span>
            </label>
          ))}
        </div>
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
