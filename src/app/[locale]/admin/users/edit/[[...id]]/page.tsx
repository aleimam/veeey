import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getStaff, listDepartmentsForAssign } from '@/lib/staff-service';
import { StaffForm } from '@/components/admin/staff-form';
import { pick } from '@/lib/admin-i18n';

export default async function StaffEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const uid = id?.[0];
  const [user, departments] = await Promise.all([uid ? getStaff(uid) : null, listDepartmentsForAssign()]);

  return (
    <div className="p-6">
      <Link href="/admin/users" className="text-sm text-primary hover:underline">← {tb('Users', 'المستخدمون')}</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{uid ? tb('Edit user', 'تعديل المستخدم') : tb('New user', 'مستخدم جديد')}</h1>
      <StaffForm
        id={uid}
        locale={locale}
        departments={departments}
        defaults={user ? { name: user.name ?? '', email: user.email ?? '', departmentIds: user.departments.map((m) => m.department.id) } : {}}
      />
    </div>
  );
}
