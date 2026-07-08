import { setRequestLocale } from 'next-intl/server';
import { listDepartments } from '@/lib/department-service';
import { AdminList } from '@/components/admin/resource-list';
import { deleteDepartmentAction } from '@/server/staff-actions';
import { pick } from '@/lib/admin-i18n';
import { requirePermission } from '@/lib/auth-guards';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Departments/Teams (TEAM epic) — replace Roles: editable permission sets,
 *  staff belong to one or many, effective permissions = union. */
export default async function DepartmentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  // Page-level RBAC (matches the sidebar's permission key) — the sidebar only
  // HIDES the link; without this any staffer with one permission could read it.
  await requirePermission('rbac.manage');
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const tb = pick(locale);
  const departments = await listDepartments();

  return (
    <AdminList
      title={tb('Departments & permissions', 'الأقسام والصلاحيات')}
      newHref="/admin/departments/edit"
      newLabel={tb('New department', 'قسم جديد')}
      head={[tb('Name', 'الاسم'), tb('Key', 'الكود'), tb('Members', 'الأعضاء'), tb('Permissions', 'الصلاحيات'), tb('Description', 'الوصف')]}
      notice={<>
        {one(sp.error) === 'in_use' && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {tb('This department still has members — reassign them (Users page) before deleting.', 'لا يزال لهذا القسم أعضاء — أعد تعيينهم (صفحة المستخدمين) قبل الحذف.')}
          </p>
        )}
        <p className="mb-4 rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
          {tb('Staff can belong to several departments; their effective permissions are the UNION of all of them (applied at next sign-in). The "sales" department powers the order handler picker.', 'يمكن للموظف الانتماء لعدة أقسام؛ صلاحياته الفعلية هي اتحاد صلاحياتها جميعًا (تسري عند تسجيل الدخول التالي). قسم «sales» يغذي قائمة مسؤول الطلب.')}
        </p>
      </>}
      rows={departments.map((d) => ({
        key: d.id,
        cells: [
          locale === 'ar' ? (d.nameAr ?? d.nameEn) : d.nameEn,
          d.key,
          String(d._count.members),
          String(d.permissions.length),
          d.description ?? '—',
        ],
        editHref: `/admin/departments/edit/${d.id}`,
        actions: d.key === 'super_admin' ? null : (
          <form action={deleteDepartmentAction}>
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">{tb('Delete', 'حذف')}</button>
          </form>
        ),
      }))}
    />
  );
}
