import { auth } from '@/auth';
import type { PermissionKey } from '@/lib/permissions';
import { hasPermission } from '@/lib/rbac';

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  roleKey: string | null;
  permissions: string[];
  customerId: string | null;
};

/** Current authenticated user (with RBAC context) or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Throwable guard for server actions: ensures a permission is held. */
export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, key)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
