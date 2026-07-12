import type { PermissionKey } from '@/lib/permissions';

/**
 * Admin sidebar structure — shared by the admin layout (renders it) and the
 * dashboard quick cards (resolves most-visited hrefs back to label keys +
 * icons). Section titles are bilingual [en, ar]; item labels come from the
 * `admin.nav.<key>` message keys; icon = the item key (mapped in AdminShell).
 */
export type AdminNavItem = { href: string; key: string; permission?: PermissionKey };
export type AdminNavSection = { title: [string, string]; items: AdminNavItem[] };

export const NAV_SECTIONS: AdminNavSection[] = [
  { title: ['Dashboard', 'الرئيسية'], items: [
    { href: '/admin', key: 'dashboard' },
    { href: '/admin/analytics', key: 'analytics', permission: 'finance.read' },
    { href: '/admin/analytics/sales', key: 'salesAnalytics', permission: 'finance.read' },
  ] },
  { title: ['Orders', 'الطلبات'], items: [
    { href: '/admin/orders', key: 'orders', permission: 'orders.read' },
    { href: '/admin/returns', key: 'returns', permission: 'returns.manage' },
    { href: '/admin/special-orders', key: 'specialOrders', permission: 'orders.read' },
    { href: '/admin/gifts', key: 'gifts', permission: 'orders.write' },
  ] },
  { title: ['Catalog', 'الكتالوج'], items: [
    { href: '/admin/products', key: 'products', permission: 'catalog.read' },
    { href: '/admin/seo-health', key: 'seoHealth', permission: 'catalog.read' },
    { href: '/admin/search-rules', key: 'searchRules', permission: 'catalog.write' },
    { href: '/admin/go-live', key: 'goLive', permission: 'catalog.write' },
    { href: '/admin/brands', key: 'brands', permission: 'catalog.write' },
    { href: '/admin/categories', key: 'categories', permission: 'catalog.write' },
    { href: '/admin/tags', key: 'tags', permission: 'catalog.write' },
    { href: '/admin/attributes', key: 'attributes', permission: 'catalog.write' },
    { href: '/admin/collections', key: 'collections', permission: 'content.manage' },
  ] },
  { title: ['Inventory', 'المخزون'], items: [
    { href: '/admin/inventory', key: 'inventory', permission: 'inventory.manage' },
    { href: '/admin/inventory/requests', key: 'reorderRequests', permission: 'inventory.manage' },
    { href: '/admin/inventory/expiry', key: 'expiryFight', permission: 'inventory.manage' },
    { href: '/admin/stocktake', key: 'stocktake', permission: 'stocktake.manage' },
  ] },
  { title: ['Shipping', 'الشحن'], items: [
    { href: '/admin/shipping', key: 'shipping', permission: 'settings.manage' },
  ] },
  { title: ['Customers', 'العملاء'], items: [
    { href: '/admin/customers', key: 'customers', permission: 'customers.read' },
    { href: '/admin/abandoned-carts', key: 'abandonedCarts', permission: 'customers.read' },
    { href: '/admin/tiers', key: 'tiers', permission: 'pricing.manage' },
    { href: '/admin/coupons', key: 'coupons', permission: 'coupons.manage' },
    { href: '/admin/reviews', key: 'reviews', permission: 'reviews.moderate' },
    { href: '/admin/questions', key: 'questions', permission: 'reviews.moderate' },
  ] },
  // Appearance — theming, page-building & site chrome (req: one "Appearance" group).
  { title: ['Appearance', 'المظهر'], items: [
    { href: '/admin/branding', key: 'branding', permission: 'settings.manage' },
    { href: '/admin/watermark', key: 'watermark', permission: 'catalog.write' },
    { href: '/admin/appearance', key: 'appearance', permission: 'settings.manage' },
    { href: '/admin/homepage', key: 'homepage', permission: 'content.manage' },
    { href: '/admin/navigation', key: 'navigation', permission: 'settings.manage' },
    { href: '/admin/landing', key: 'landing', permission: 'content.manage' },
    { href: '/admin/page-sections', key: 'pageSections', permission: 'content.manage' },
  ] },
  // Content — static/policy pages, the medical blog & other content (req: one "Content" group).
  { title: ['Content', 'المحتوى'], items: [
    { href: '/admin/content/pages', key: 'cmsPages', permission: 'content.manage' },
    { href: '/admin/content/blog', key: 'blog', permission: 'content.manage' },
    { href: '/admin/social', key: 'social', permission: 'content.manage' },
    { href: '/admin/quizzes', key: 'quizzes', permission: 'content.manage' },
  ] },
  { title: ['Tools', 'الأدوات'], items: [
    { href: '/admin/notifications', key: 'notifications', permission: 'content.manage' },
  ] },
  { title: ['Users & departments', 'المستخدمون والأقسام'], items: [
    { href: '/admin/users', key: 'users', permission: 'rbac.manage' },
    { href: '/admin/departments', key: 'departments', permission: 'rbac.manage' },
  ] },
  { title: ['Administration', 'الإدارة'], items: [
    { href: '/admin/settings', key: 'settings', permission: 'settings.manage' },
    { href: '/admin/order-statuses', key: 'orderStatuses', permission: 'settings.manage' },
    { href: '/admin/change-log', key: 'changeLog', permission: 'settings.manage' },
    { href: '/admin/error-log', key: 'errorLog', permission: 'settings.manage' },
  ] },
  // Integrations & API — every external connection/API EXCEPT the Egypt Vitamins
  // migration link, which stays in its own group (req: gather integrations here).
  { title: ['Integrations & API', 'التكاملات والواجهات'], items: [
    { href: '/admin/ai-keys', key: 'aiKeys', permission: 'settings.manage' },
    { href: '/admin/ai-approvals', key: 'aiApprovals', permission: 'settings.manage' },
    { href: '/admin/google', key: 'google', permission: 'settings.manage' },
    { href: '/admin/payments', key: 'payments', permission: 'settings.manage' },
    { href: '/admin/providers', key: 'providers', permission: 'settings.manage' },
    { href: '/admin/login-providers', key: 'loginProviders', permission: 'settings.manage' },
    { href: '/admin/integration', key: 'integration', permission: 'settings.manage' },
  ] },
  { title: ['Egypt Vitamins', 'إيجيبت فيتامينز'], items: [
    { href: '/admin/woocommerce', key: 'wooConnection', permission: 'settings.manage' },
    { href: '/admin/woocommerce/products', key: 'wooProducts', permission: 'settings.manage' },
    { href: '/admin/woocommerce/customers', key: 'wooCustomers', permission: 'settings.manage' },
    { href: '/admin/woocommerce/orders', key: 'wooOrders', permission: 'settings.manage' },
    { href: '/admin/woocommerce/import', key: 'wooImport', permission: 'settings.manage' },
    { href: '/admin/woocommerce/sync', key: 'wooSync', permission: 'settings.manage' },
    { href: '/admin/woocommerce/cleanup', key: 'wooCleanup', permission: 'settings.manage' },
  ] },
];

export const NAV_ITEMS: AdminNavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
