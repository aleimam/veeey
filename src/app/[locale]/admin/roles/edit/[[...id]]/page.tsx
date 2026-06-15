import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getRole } from '@/lib/role-service';
import { PERMISSION_CATALOG } from '@/lib/permissions';
import { RoleForm } from '@/components/admin/role-form';

export default async function RoleEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const rid = id?.[0];
  const role = rid ? await getRole(rid) : null;
  const permissions = Object.entries(PERMISSION_CATALOG).map(([key, description]) => ({ key, description }));

  return (
    <div className="p-6">
      <Link href="/admin/roles" className="text-sm text-primary hover:underline">← Roles</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{rid ? 'Edit role' : 'New role'}</h1>
      <RoleForm
        id={rid}
        locale={locale}
        permissions={permissions}
        defaults={role ? {
          key: role.key, name: role.name, description: role.description,
          permissionKeys: role.permissions.map((p) => p.key),
        } : {}}
      />
    </div>
  );
}
