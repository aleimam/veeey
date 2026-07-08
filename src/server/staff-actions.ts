'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createStaff, updateStaff, revokeStaff } from '@/lib/staff-service';
import { saveDepartment, deleteDepartment } from '@/lib/department-service';
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
  const departmentIds = fd.getAll('departmentIds').filter((v): v is string => typeof v === 'string' && v !== '');
  try {
    if (id) {
      await updateStaff(id, {
        name: str(fd, 'name') ?? '',
        departmentIds,
        password: str(fd, 'password') ?? '',
      });
    } else {
      await createStaff({
        name: str(fd, 'name') ?? '',
        email: str(fd, 'email') ?? '',
        password: str(fd, 'password') ?? '',
        departmentIds,
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

// ---- Departments (replace Roles — TEAM epic) --------------------------------
export async function saveDepartmentAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveDepartment(str(fd, 'id') ?? null, {
      key: str(fd, 'key') ?? '',
      nameEn: str(fd, 'nameEn') ?? '',
      nameAr: str(fd, 'nameAr') ?? null,
      description: str(fd, 'description') ?? null,
      permissionKeys: fd.getAll('permissions').filter((v): v is string => typeof v === 'string'),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/${locale}/admin/departments`);
  redirect(`/${locale}/admin/departments`);
}

export async function deleteDepartmentAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try {
      await deleteDepartment(id);
    } catch (e) {
      if (e instanceof Error && e.message === 'IN_USE') {
        revalidatePath(`/${locale}/admin/departments`);
        redirect(`/${locale}/admin/departments?error=in_use`);
      }
      fail(e);
    }
  }
  revalidatePath(`/${locale}/admin/departments`);
  redirect(`/${locale}/admin/departments`);
}
