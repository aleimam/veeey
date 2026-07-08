import { setRequestLocale } from 'next-intl/server';
import { listStaff } from '@/lib/staff-service';
import { AdminList } from '@/components/admin/resource-list';
import { revokeStaffAction } from '@/server/staff-actions';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function UsersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const staff = await listStaff();
  const selfError = one(sp.error) === 'self';

  return (
    <AdminList
      title={tb('Users', 'المستخدمون')}
      newHref="/admin/users/edit"
      newLabel={tb('New user', 'مستخدم جديد')}
      head={[tb('Name', 'الاسم'), tb('Email', 'البريد الإلكتروني'), tb('Departments', 'الأقسام')]}
      editLabel={tb('Edit', 'تعديل')}
      notice={selfError ? (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {tb("You can't revoke your own access.", 'لا يمكنك إلغاء صلاحيتك.')}
        </p>
      ) : undefined}
      rows={staff.map((u) => ({
        key: u.id,
        cells: [u.name ?? '—', u.email ?? '—', u.departments.length ? u.departments.map((m) => m.department.nameEn).join(', ') : '—'],
        editHref: `/admin/users/edit/${u.id}`,
        actions: (
          <form action={revokeStaffAction}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">{tb('Revoke access', 'إلغاء الصلاحية')}</button>
          </form>
        ),
      }))}
    />
  );
}
