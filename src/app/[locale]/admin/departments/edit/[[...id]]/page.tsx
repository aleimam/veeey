import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getDepartment } from '@/lib/department-service';
import { PERMISSION_CATALOG } from '@/lib/permissions';
import { DepartmentForm } from '@/components/admin/department-form';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

export default async function DepartmentEditPage({ params }: { params: Promise<{ locale: string; id?: string[] }> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('rbac.manage');
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const did = id?.[0];
  const dept = did ? await getDepartment(did) : null;
  const permissions = Object.entries(PERMISSION_CATALOG).map(([key, description]) => ({ key, description }));

  return (
    <div className="p-6">
      <Link href="/admin/departments" className="text-sm text-primary hover:underline">← {tb('Departments', 'الأقسام')}</Link>
      <h1 className="mb-6 mt-2 font-heading text-xl font-semibold">{did ? tb('Edit department', 'تعديل القسم') : tb('New department', 'قسم جديد')}</h1>
      <DepartmentForm
        id={did}
        locale={locale}
        permissions={permissions}
        defaults={dept ? {
          key: dept.key, nameEn: dept.nameEn, nameAr: dept.nameAr, description: dept.description,
          permissionKeys: dept.permissions.map((p) => p.key),
        } : {}}
      />

      {dept && (
        <section className="mt-8 max-w-2xl rounded-lg border border-border p-4">
          <h2 className="mb-2 text-sm font-semibold">{tb(`Members (${dept.members.length})`, `الأعضاء (${dept.members.length})`)}</h2>
          {dept.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tb('No members yet — assign departments from each user\'s edit page.', 'لا أعضاء بعد — عيّن الأقسام من صفحة تعديل كل مستخدم.')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {dept.members.map((m) => (
                <li key={m.id}>
                  <Link href={`/admin/users/edit/${m.user.id}`} className="text-primary hover:underline">{m.user.name ?? m.user.email ?? m.user.id}</Link>
                  {m.user.email && <span className="ms-2 text-xs text-muted-foreground">{m.user.email}</span>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{tb('Membership is managed on the Users page (a user can be in several departments).', 'تُدار العضوية من صفحة المستخدمين (يمكن للمستخدم الانتماء لعدة أقسام).')}</p>
        </section>
      )}
    </div>
  );
}
