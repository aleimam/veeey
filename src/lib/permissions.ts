/**
 * Permission + role catalog — single source of truth (FR-RBAC-01/02, SPEC §17).
 * Imported by both the seed (to insert rows) and runtime RBAC checks (to type
 * keys), so the two can never drift. Roles & their grants are admin-configurable
 * at runtime; these are the seeded defaults.
 */

export const PERMISSION_CATALOG = {
  'catalog.read': 'View catalog',
  'catalog.write': 'Create/edit products & taxonomy',
  'inventory.manage': 'Manage lots, intake, price-per-expiry',
  'stocktake.manage': 'Run stocktake sessions',
  'orders.read': 'View orders',
  'orders.write': 'Create/edit orders',
  'orders.fulfill': 'Fulfillment, tracking, delivery assignment',
  'pricing.manage': 'Manage pricing, tiers, loyalty config',
  'coupons.manage': 'Manage coupons & campaigns',
  'customers.read': 'View customers',
  'customers.write': 'Edit customers',
  'content.manage': 'CMS, blog, collections, theming',
  'seo.manage': 'SEO/AEO fields & feeds',
  'marketing.manage': 'Marketing, attribution, analytics config',
  'finance.read': 'View finance & reports',
  'finance.manage': 'Refunds, revenue, exports',
  'returns.manage': 'Process returns & quarantine',
  'reviews.moderate': 'Moderate reviews',
  'couriers.access': 'Couriers module (own delivery jobs)',
  'rbac.manage': 'Manage roles & permissions',
  'settings.manage': 'System settings & integrations',
  'ai.manage': 'Configure AI/MCP access',
} as const;

export type PermissionKey = keyof typeof PERMISSION_CATALOG;

export const PERMISSION_KEYS = Object.keys(PERMISSION_CATALOG) as PermissionKey[];

export type RoleDefinition = {
  key: string;
  name: string;
  /** '*' grants every permission. */
  permissions: PermissionKey[] | '*';
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  { key: 'super_admin', name: 'Super Admin', permissions: '*' },
  {
    key: 'admin',
    name: 'Admin',
    permissions: PERMISSION_KEYS.filter(
      (p) => p !== 'rbac.manage' && p !== 'settings.manage',
    ),
  },
  {
    key: 'pharmacist',
    name: 'Pharmacist (Sales)',
    permissions: [
      'catalog.read', 'orders.read', 'orders.write', 'inventory.manage',
      'customers.read', 'reviews.moderate',
    ],
  },
  {
    key: 'operations',
    name: 'Operations',
    permissions: ['orders.read', 'orders.fulfill', 'stocktake.manage', 'couriers.access'],
  },
  {
    key: 'content_seo',
    name: 'Content/SEO',
    permissions: ['catalog.read', 'catalog.write', 'content.manage', 'seo.manage'],
  },
  {
    key: 'marketing',
    name: 'Marketing',
    permissions: ['coupons.manage', 'marketing.manage', 'pricing.manage', 'catalog.read'],
  },
  {
    key: 'finance',
    name: 'Finance',
    permissions: ['finance.read', 'finance.manage', 'orders.read'],
  },
  {
    key: 'support',
    name: 'Customer Support',
    permissions: ['orders.read', 'customers.read', 'customers.write', 'returns.manage'],
  },
  { key: 'courier', name: 'Courier', permissions: ['couriers.access'] },
];

/** Resolve a role's permission keys (expands '*'). */
export function permissionsForRole(role: RoleDefinition): PermissionKey[] {
  return role.permissions === '*' ? PERMISSION_KEYS : role.permissions;
}
