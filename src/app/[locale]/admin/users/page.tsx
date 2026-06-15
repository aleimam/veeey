import { setRequestLocale } from 'next-intl/server';
import { listStaff } from '@/lib/staff-service';
import { AdminList } from '@/components/admin/resource-list';
import { revokeStaffAction } from '@/server/staff-actions';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function UsersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const staff = await listStaff();
  const selfError = one(sp.error) === 'self';

  return (
    <AdminList
      title="Staff users"
      newHref="/admin/users/edit"
      newLabel="New user"
      head={['Name', 'Email', 'Role']}
      editLabel="Edit"
      notice={selfError ? (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          You can’t revoke your own access.
        </p>
      ) : undefined}
      rows={staff.map((u) => ({
        key: u.id,
        cells: [u.name ?? '—', u.email ?? '—', u.role?.name ?? '—'],
        editHref: `/admin/users/edit/${u.id}`,
        actions: (
          <form action={revokeStaffAction}>
            <input type="hidden" name="id" value={u.id} />
            <input type="hidden" name="locale" value={locale} />
            <button className="text-destructive hover:underline">Revoke access</button>
          </form>
        ),
      }))}
    />
  );
}
