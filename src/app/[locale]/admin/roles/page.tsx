import { setRequestLocale } from 'next-intl/server';
import { listRoles } from '@/lib/role-service';
import { AdminList } from '@/components/admin/resource-list';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteRoleAction } from '@/server/staff-actions';
import { pick } from '@/lib/admin-i18n';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RolesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const roles = await listRoles();

  return (
    <AdminList
      title={tb('Roles & permissions', 'الأدوار والصلاحيات')}
      newHref="/admin/roles/edit"
      newLabel={tb('New role', 'دور جديد')}
      head={[tb('Name', 'الاسم'), tb('Key', 'الكود'), tb('Description', 'الوصف'), tb('Users', 'المستخدمون'), tb('Permissions', 'الصلاحيات')]}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={roles.map((r) => ({
        key: r.id,
        cells: [r.name, r.key, r.description ?? '—', String(r._count.users), String(r._count.permissions)],
        editHref: `/admin/roles/edit/${r.id}`,
        actions: r.key === 'super_admin' ? null : (
          <form action={deleteRoleAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
          </form>
        ),
      }))}
    />
  );
}
