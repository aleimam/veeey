import { authenticateMcp } from '@/lib/mcp-auth';
import { prisma } from '@/lib/prisma';
import { visibleProductWhere } from '@/lib/storefront';

/** AI-MCP read endpoint (FR-MCP-01): key/HMAC-gated catalog + live stock summary.
 *  Requires the `catalog:read` scope. */
export async function GET(req: Request) {
  const auth = await authenticateMcp(req, '');
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!auth.scopes.includes('catalog:read')) return Response.json({ error: 'forbidden', need: 'catalog:read' }, { status: 403 });

  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', AND: [visibleProductWhere] },
    select: { sku: true, nameEn: true, basePricePiastres: true, ratingAvg: true, ratingCount: true, lots: { where: { status: 'LIVE' }, select: { qtyOnHand: true } } },
    take: 500,
  });
  const data = products.map((p) => ({
    sku: p.sku,
    name: p.nameEn,
    priceEgp: Number(p.basePricePiastres) / 100,
    rating: p.ratingAvg,
    reviews: p.ratingCount,
    stock: p.lots.reduce((s, l) => s + l.qtyOnHand, 0),
  }));
  return Response.json({ count: data.length, products: data });
}
