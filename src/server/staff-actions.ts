'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createStaff, updateStaff, revokeStaff } from '@/lib/staff-service';
import { saveRole, deleteRole } from '@/lib/role-service';
import { InUseError } from '@/lib/soft-delete-service';
import type { AdminFormState } from '@/server/admin-actions';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string): string | undefined => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

function fail(e: unknown): AdminFormState {
  if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
  if (e instanceof Error && e.message === 'EXISTS') return { error: 'exists' };
  if (e instanceof Error && e.message === 'SELF') return { error: 'self' };
  console.error('staff/role action failed', e);
  return { error: 'invalid' };
}

// ---- Staff -----------------------------------------------------------------
export async function saveStaffAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  try {
    if (id) {
      await updateStaff(id, {
        name: str(fd, 'name') ?? '',
        roleId: str(fd, 'roleId') ?? '',
        password: str(fd, 'password') ?? '',
      });
    } else {
      await createStaff({
        name: str(fd, 'name') ?? '',
        email: str(fd, 'email') ?? '',
        password: str(fd, 'password') ?? '',
        roleId: str(fd, 'roleId') ?? '',
      });
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/${locale}/admin/users`);
  redirect(`/${locale}/admin/users`);
}

export async function revokeStaffAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try {
      await revokeStaff(id);
    } catch (e) {
      if (e instanceof Error && e.message === 'SELF') {
        revalidatePath(`/${locale}/admin/users`);
        redirect(`/${locale}/admin/users?error=self`);
      }
      fail(e);
    }
  }
  revalidatePath(`/${locale}/admin/users`);
  redirect(`/${locale}/admin/users`);
}

// ---- Roles -----------------------------------------------------------------
export async function saveRoleAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveRole(str(fd, 'id') ?? null, {
      key: str(fd, 'key') ?? '',
      name: str(fd, 'name') ?? '',
      description: str(fd, 'description') ?? null,
      permissionKeys: fd.getAll('permissions').filter((v): v is string => typeof v === 'string'),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/${locale}/admin/roles`);
  redirect(`/${locale}/admin/roles`);
}

export async function deleteRoleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try {
      await deleteRole(id);
    } catch (e) {
      if (e instanceof InUseError) {
        revalidatePath(`/${locale}/admin/roles`);
        redirect(`/${locale}/admin/roles?error=in_use`);
      }
      fail(e);
    }
  }
  revalidatePath(`/${locale}/admin/roles`);
  redirect(`/${locale}/admin/roles`);
}
