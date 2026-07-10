/**
 * GTM/GA4 bridge (Analytics P4). Maps our first-party clickstream events to the
 * standard GA4 ecommerce schema and pushes them to window.dataLayer (for GTM) +
 * gtag (for direct GA4). Consent is handled upstream by the GoogleLoader +
 * Consent Mode v2 — these pushes are inert until a tag is actually loaded.
 * `gaEvent` is pure (no window) so it's unit-testable.
 */
const GA_MAP: Record<string, string> = {
  product_view: 'view_item',
  product_list_view: 'view_item_list',
  add_to_cart: 'add_to_cart',
  remove_from_cart: 'remove_from_cart',
  wishlist_add: 'add_to_wishlist',
  checkout_start: 'begin_checkout',
  checkout_step: 'begin_checkout',
  purchase: 'purchase',
  search: 'search',
};

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export type GaEvent = { event: string; params: Record<string, unknown>; ecommerce: boolean };

/** Map a first-party (name, props) to a GA4 event + params, or null if not mapped. */
export function gaEvent(name: string, props: Record<string, unknown> = {}): GaEvent | null {
  const event = GA_MAP[name];
  if (!event) return null;

  if (event === 'search') {
    const term = String(props.q ?? props.query ?? '').trim();
    return term ? { event, params: { search_term: term }, ecommerce: false } : null;
  }

  const price = num(props.price);
  const quantity = num(props.qty ?? props.quantity) ?? 1;
  let items: Record<string, unknown>[];
  if (Array.isArray(props.items) && props.items.length) {
    // Caller supplied a ready line-item array (e.g. a multi-line purchase).
    items = props.items as Record<string, unknown>[];
  } else {
    const itemId = props.sku ?? props.item_id ?? props.id;
    if (itemId == null) return null; // an ecommerce event needs at least an item id
    const item: Record<string, unknown> = { item_id: String(itemId), quantity };
    const itemName = props.name ?? props.item_name;
    if (itemName != null) item.item_name = String(itemName);
    if (price != null) item.price = price;
    items = [item];
  }

  const value = num(props.value ?? props.total) ?? (price != null ? price * quantity : undefined);
  const params: Record<string, unknown> = { currency: String(props.currency ?? 'EGP'), items };
  if (value != null) params.value = value;
  if (event === 'purchase') {
    const tx = props.orderId ?? props.transaction_id;
    if (tx != null) params.transaction_id = String(tx);
  }
  return { event, params, ecommerce: true };
}

/** Push a mapped event to the GTM dataLayer + gtag (no-op on the server / unmapped). */
export function pushDataLayer(name: string, props?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  const g = gaEvent(name, props);
  if (!g) return;
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(g.ecommerce ? { event: g.event, ecommerce: g.params } : { event: g.event, ...g.params });
  if (typeof w.gtag === 'function') w.gtag('event', g.event, g.params);
}
