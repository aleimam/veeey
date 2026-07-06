/**
 * Pre-order cart (buy a product before it is back in stock). Unlike the normal
 * cart — which IS a set of FEFO lot soft-holds — a pre-order line has no lot to
 * reserve, so it lives as a small JSON list in its own cookie: `[{productId,
 * qty}]`. Pure parse/mutate helpers so the grammar is unit-testable; the
 * cart-service reads/writes the cookie, checkout turns the lines into
 * awaiting-stock OrderItems with a deposit.
 */

export const PREORDER_COOKIE = 'veeey-preorder';

export type PreorderLine = { productId: string; qty: number };

const MAX_LINES = 30;
const MAX_QTY = 99;

const clampQty = (n: unknown) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number(n) || 1)));

export function parsePreorderCart(raw: string | null | undefined): PreorderLine[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: PreorderLine[] = [];
    for (const item of v) {
      const productId = item && typeof item.productId === 'string' ? item.productId : null;
      if (!productId) continue;
      const existing = out.find((l) => l.productId === productId);
      if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + clampQty(item.qty));
      else if (out.length < MAX_LINES) out.push({ productId, qty: clampQty(item.qty) });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializePreorderCart(lines: PreorderLine[]): string {
  return JSON.stringify(lines.filter((l) => l.qty > 0).slice(0, MAX_LINES));
}

export function addPreorderLine(lines: PreorderLine[], productId: string, qty = 1): PreorderLine[] {
  if (!productId) return lines;
  const add = clampQty(qty);
  const existing = lines.find((l) => l.productId === productId);
  if (existing) return lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(MAX_QTY, l.qty + add) } : l));
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { productId, qty: add }];
}

/** Set an exact quantity; qty <= 0 removes the line. */
export function setPreorderQty(lines: PreorderLine[], productId: string, qty: number): PreorderLine[] {
  if (qty <= 0) return removePreorderLine(lines, productId);
  return lines.map((l) => (l.productId === productId ? { ...l, qty: clampQty(qty) } : l));
}

export function removePreorderLine(lines: PreorderLine[], productId: string): PreorderLine[] {
  return lines.filter((l) => l.productId !== productId);
}

export const preorderCount = (lines: PreorderLine[]): number => lines.reduce((s, l) => s + l.qty, 0);
