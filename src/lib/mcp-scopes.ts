/**
 * MCP / AI access scopes (FR-MCP-01/03). A key is granted a subset of these;
 * the read endpoint requires `catalog:read`, and every proposed write requires
 * the scope its action maps to. Pure + unit-tested.
 */
export type McpScope = 'catalog:read' | 'catalog:write' | 'orders:read' | 'reviews:moderate' | 'content:write';

export const MCP_SCOPES: { value: McpScope; labelEn: string; labelAr: string; write: boolean }[] = [
  { value: 'catalog:read', labelEn: 'Read catalog (products, prices, stock)', labelAr: 'قراءة الكتالوج (المنتجات والأسعار والمخزون)', write: false },
  { value: 'catalog:write', labelEn: 'Propose product changes', labelAr: 'اقتراح تعديلات على المنتجات', write: true },
  { value: 'orders:read', labelEn: 'Read orders', labelAr: 'قراءة الطلبات', write: false },
  { value: 'reviews:moderate', labelEn: 'Propose review moderation', labelAr: 'اقتراح إدارة المراجعات', write: true },
  { value: 'content:write', labelEn: 'Propose content/page changes', labelAr: 'اقتراح تعديلات المحتوى/الصفحات', write: true },
];

export const ALL_SCOPES: McpScope[] = MCP_SCOPES.map((s) => s.value);
const VALID = new Set<string>(ALL_SCOPES);

export function sanitizeScopes(raw: unknown): McpScope[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.filter((s): s is McpScope => typeof s === 'string' && VALID.has(s));
  return [...new Set(out)];
}

/** The scope a proposed write action requires (by action prefix). */
export function requiredWriteScope(action: string): McpScope {
  const a = (action || '').toLowerCase();
  if (a.startsWith('review') || a.startsWith('question')) return 'reviews:moderate'; // community-content moderation
  if (a.startsWith('content') || a.startsWith('page') || a.startsWith('blog') || a.startsWith('cms')) return 'content:write';
  return 'catalog:write'; // product.* and anything else defaults to catalog write
}

export const hasScope = (scopes: string[], needed: McpScope): boolean => scopes.includes(needed);
