import { entityHistory, type ChangeLogEntry } from '@/lib/change-log-service';
import { pick } from '@/lib/admin-i18n';

/** Admin edit URLs for entities that have their own page — used to linkify log rows. */
export const ENTITY_EDIT_URL: Record<string, (id: string) => string> = {
  Product: (id) => `/admin/products/edit/${id}`,
  Order: (id) => `/admin/orders/${id}`,
  Lot: (id) => `/admin/inventory/lots/edit/${id}`,
  Brand: (id) => `/admin/brands/edit/${id}`,
  Category: (id) => `/admin/categories/edit/${id}`,
  Tag: (id) => `/admin/tags/edit/${id}`,
  Attribute: (id) => `/admin/attributes/edit/${id}`,
  Collection: (id) => `/admin/collections/edit/${id}`,
  Coupon: (id) => `/admin/coupons/edit/${id}`,
  Gift: (id) => `/admin/gifts/edit/${id}`,
  CmsPage: (id) => `/admin/content/pages/edit/${id}`,
  BlogPost: (id) => `/admin/content/blog/edit/${id}`,
  Tier: (id) => `/admin/tiers/edit/${id}`,
  User: (id) => `/admin/users/edit/${id}`,
  Role: (id) => `/admin/roles/edit/${id}`,
  SpecialOrder: (id) => `/admin/special-orders/${id}`,
  Return: (id) => `/admin/returns/${id}`,
  SocialLink: (id) => `/admin/social/edit/${id}`,
  HomeTestimonial: (id) => `/admin/homepage/testimonials/edit/${id}`,
  HomeTrustBadge: (id) => `/admin/homepage/trust/edit/${id}`,
  PageLayout: (id) => `/admin/landing/edit/${id}`,
};

const show = (v: unknown): string => (v == null || v === '' ? '—' : String(v));

/** One log entry's payload: field diffs, delete snapshot, or free-form meta. */
export function ChangeDetail({ entry, locale }: { entry: ChangeLogEntry; locale: string }) {
  const tb = pick(locale);
  if (entry.changes && entry.changes.length > 0) {
    const rows = entry.changes;
    const body = (
      <ul className="space-y-0.5">
        {rows.map((c) => (
          <li key={c.field} className="text-xs">
            <span className="font-mono font-medium">{c.field}</span>
            <span className="text-muted-foreground"> : </span>
            <span className="text-destructive/80 line-through decoration-destructive/40">{show(c.from)}</span>
            <span className="text-muted-foreground"> → </span>
            <span className="font-medium text-foreground">{show(c.to)}</span>
          </li>
        ))}
      </ul>
    );
    if (rows.length <= 3) return body;
    return (
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          {tb(`${rows.length} fields changed`, `${rows.length} حقلًا تغيّر`)}
        </summary>
        <div className="mt-1">{body}</div>
      </details>
    );
  }
  if (entry.snapshot) {
    const entries = Object.entries(entry.snapshot).filter(([, v]) => v != null && v !== '');
    return (
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">{tb('Deleted record', 'السجل المحذوف')}</summary>
        <ul className="mt-1 space-y-0.5">
          {entries.map(([k, v]) => (
            <li key={k} className="text-xs"><span className="font-mono font-medium">{k}</span><span className="text-muted-foreground"> : </span>{show(v)}</li>
          ))}
        </ul>
      </details>
    );
  }
  if (entry.meta && Object.keys(entry.meta).length > 0) {
    return <span className="break-all text-xs text-muted-foreground">{JSON.stringify(entry.meta)}</span>;
  }
  return null;
}

export function ActionBadge({ action }: { action: string }) {
  const tone = action.endsWith('.delete') || action.endsWith('.deleteMany')
    ? 'bg-destructive/10 text-destructive'
    : action.endsWith('.create')
      ? 'bg-primary/10 text-primary'
      : 'bg-surface text-muted-foreground';
  return <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${tone}`}>{action}</span>;
}

const fmtTime = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

/**
 * Per-entity history panel (owner batch #6) — embed at the bottom of an admin
 * edit page to show who created/edited the record and exactly what changed.
 */
export async function ChangeHistory({ entityType, entityId, locale }: { entityType: string; entityId: string; locale: string }) {
  const tb = pick(locale);
  let entries: ChangeLogEntry[] = [];
  try {
    entries = await entityHistory(entityType, entityId);
  } catch {
    return null; // viewer lacks admin access — hide silently
  }
  if (entries.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-heading text-lg font-semibold">{tb('Change history', 'سجل التغييرات')}</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-start">{tb('When (UTC)', 'الوقت (UTC)')}</th>
              <th className="p-2 text-start">{tb('Who', 'مَن')}</th>
              <th className="p-2 text-start">{tb('Action', 'الإجراء')}</th>
              <th className="p-2 text-start">{tb('Details', 'التفاصيل')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">{fmtTime(e.createdAt)}</td>
                <td className="p-2 text-xs">{e.actorLabel}</td>
                <td className="p-2"><ActionBadge action={e.action} /></td>
                <td className="p-2"><ChangeDetail entry={e} locale={locale} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
