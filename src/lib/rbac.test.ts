import { describe, expect, it } from 'vitest';
import { hasPermission, hasAnyPermission, hasAllPermissions, canAccessAdmin } from './rbac';

describe('rbac', () => {
  it('hasPermission checks a single key', () => {
    expect(hasPermission(['orders.read'], 'orders.read')).toBe(true);
    expect(hasPermission(['orders.read'], 'orders.write')).toBe(false);
    expect(hasPermission(undefined, 'orders.read')).toBe(false);
  });

  it('hasAnyPermission / hasAllPermissions', () => {
    const granted = ['catalog.read', 'orders.read'];
    expect(hasAnyPermission(granted, ['orders.read', 'finance.manage'])).toBe(true);
    expect(hasAnyPermission(granted, ['finance.manage'])).toBe(false);
    expect(hasAllPermissions(granted, ['catalog.read', 'orders.read'])).toBe(true);
    expect(hasAllPermissions(granted, ['catalog.read', 'finance.manage'])).toBe(false);
  });

  it('canAccessAdmin requires at least one permission', () => {
    expect(canAccessAdmin([])).toBe(false);
    expect(canAccessAdmin(['orders.read'])).toBe(true);
    expect(canAccessAdmin(null)).toBe(false);
  });
});
