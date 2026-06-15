import { setRequestLocale } from 'next-intl/server';
import { listRoles } from '@/lib/role-service';
import { AdminList } from '@/components/admin/resource-list';
import { InUseNotice } from '@/components/admin/row-actions';
import { deleteRoleAction } from '@/server/staff-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RolesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const roles = await listRoles();

  return (
    <AdminList
      title="Roles & permissions"
      newHref="/admin/roles/edit"
      newLabel="New role"
      head={['Name', 'Key', 'Description', 'Users', 'Permissions']}
      notice={<InUseNotice show={one(sp.error) === 'in_use'} />}
      rows={roles.map((r) => ({
        key: r.id,
        cells: [r.name, r.key, r.description ?? '—', String(r._count.users), String(r._count.permissions)],
        editHref: `/admin/roles/edit/${r.id}`,
        actions: r.key === 'super_admin' ? null : (
          <form action={deleteRoleAction}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">Delete</button>
          </form>
        ),
      }))}
    />
  );
}
