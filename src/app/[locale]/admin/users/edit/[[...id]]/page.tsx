import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getStaff, listRolesForAssign } from '@/lib/staff-service';
import { StaffForm } from '@/components/admin/staff-form';

export default async function StaffEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const uid = id?.[0];
  const [user, roles] = await Promise.all([uid ? getStaff(uid) : null, listRolesForAssign()]);

  return (
    <div className="p-6">
      <Link href="/admin/users" className="text-sm text-primary hover:underline">← Staff users</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{uid ? 'Edit staff user' : 'New staff user'}</h1>
      <StaffForm
        id={uid}
        locale={locale}
        roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key }))}
        defaults={user ? { name: user.name ?? '', email: user.email ?? '', roleId: user.roleId ?? '' } : {}}
      />
    </div>
  );
}
