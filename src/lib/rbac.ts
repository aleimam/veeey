import type { PermissionKey } from './permissions';

/**
 * Runtime RBAC checks (FR-RBAC-02). `granted` is the permission-key list carried
 * on the session (loaded from the user's role at sign-in). AI agents are governed
 * by this same surface — an AI "role" is just another grant list (FR-MCP-03).
 */
export function hasPermission(
  granted: readonly string[] | undefined | null,
  key: PermissionKey,
): boolean {
  return !!granted && granted.includes(key);
}

export function hasAnyPermission(
  granted: readonly string[] | undefined | null,
  keys: PermissionKey[],
): boolean {
  return !!granted && keys.some((k) => granted.includes(k));
}

export function hasAllPermissions(
  granted: readonly string[] | undefined | null,
  keys: PermissionKey[],
): boolean {
  return !!granted && keys.every((k) => granted.includes(k));
}

/** A user may enter the admin area if they hold any staff permission. */
export function canAccessAdmin(granted: readonly string[] | undefined | null): boolean {
  return !!granted && granted.length > 0;
}
