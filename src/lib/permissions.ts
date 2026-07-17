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
  'requests.manage': 'Place & manage purchasing requests',
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

/** Arabic descriptions (the matrix UI shows EN or AR per the admin locale). */
export const PERMISSION_CATALOG_AR: Record<PermissionKey, string> = {
  'catalog.read': 'عرض الكتالوج',
  'catalog.write': 'إنشاء/تعديل المنتجات والتصنيفات',
  'inventory.manage': 'إدارة التشغيلات والاستلام والسعر حسب الصلاحية',
  'stocktake.manage': 'تشغيل جلسات الجرد',
  'orders.read': 'عرض الطلبات',
  'orders.write': 'إنشاء/تعديل الطلبات',
  'orders.fulfill': 'التجهيز والتتبّع وتعيين التوصيل',
  'requests.manage': 'إنشاء وإدارة طلبات الشراء',
  'pricing.manage': 'إدارة الأسعار والفئات وإعداد الولاء',
  'coupons.manage': 'إدارة الكوبونات والحملات',
  'customers.read': 'عرض العملاء',
  'customers.write': 'تعديل العملاء',
  'content.manage': 'المحتوى والمدونة والمجموعات والثيمات',
  'seo.manage': 'حقول وأعلاف SEO/AEO',
  'marketing.manage': 'التسويق والإحالة وإعداد التحليلات',
  'finance.read': 'عرض المالية والتقارير',
  'finance.manage': 'المبالغ المستردة والإيرادات والتصدير',
  'returns.manage': 'معالجة المرتجعات والحجر',
  'reviews.moderate': 'إدارة التقييمات',
  'couriers.access': 'وحدة المندوبين (مهام التوصيل الخاصة)',
  'rbac.manage': 'إدارة الأدوار والصلاحيات',
  'settings.manage': 'إعدادات النظام والتكاملات',
  'ai.manage': 'إعداد وصول الذكاء الاصطناعي/MCP',
};

/** Logical groupings for the permission matrix (bilingual section titles). */
export const PERMISSION_GROUPS: { title: [en: string, ar: string]; keys: PermissionKey[] }[] = [
  { title: ['Catalog & inventory', 'الكتالوج والمخزون'], keys: ['catalog.read', 'catalog.write', 'inventory.manage', 'stocktake.manage'] },
  { title: ['Orders & returns', 'الطلبات والمرتجعات'], keys: ['orders.read', 'orders.write', 'orders.fulfill', 'requests.manage', 'returns.manage', 'couriers.access'] },
  { title: ['Pricing & marketing', 'الأسعار والتسويق'], keys: ['pricing.manage', 'coupons.manage', 'marketing.manage'] },
  { title: ['Customers & reviews', 'العملاء والتقييمات'], keys: ['customers.read', 'customers.write', 'reviews.moderate'] },
  { title: ['Content & SEO', 'المحتوى وSEO'], keys: ['content.manage', 'seo.manage'] },
  { title: ['Finance', 'المالية'], keys: ['finance.read', 'finance.manage'] },
  { title: ['System & access', 'النظام والوصول'], keys: ['rbac.manage', 'settings.manage', 'ai.manage'] },
];

export type RoleDefinition = {
  key: string;
  name: string;
  /** '*' grants every permission. */
  permissions: PermissionKey[] | '*';
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  { key: 'super_admin', name: 'Super Admin', permissions: '*' },
  {
    // Full trust (owner decision 2026-07-12): admins manage everything,
    // including RBAC + integrations, same surface as super_admin.
    key: 'admin',
    name: 'Admin',
    permissions: '*',
  },
  {
    key: 'pharmacist',
    name: 'Pharmacist (Sales)',
    permissions: [
      'catalog.read', 'orders.read', 'orders.write', 'inventory.manage',
      'requests.manage', 'customers.read', 'reviews.moderate',
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
