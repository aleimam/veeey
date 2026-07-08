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

/** Throwable guard for server actions: ensures a permission is held.
 *  The custom `digest` survives Next's prod error redaction, so the admin
 *  error boundary can still recognize a permission denial. */
export async function requirePermission(key: PermissionKey): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, key)) {
    throw Object.assign(new Error('FORBIDDEN'), { digest: 'FORBIDDEN' });
  }
  return user;
}
