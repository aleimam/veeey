import { mcpEnabled, verifyMcp } from '@/lib/mcp-auth';
import { prisma } from '@/lib/prisma';

/** AI-MCP read endpoint (FR-MCP-01): HMAC-gated catalog + live stock summary. */
export async function GET(req: Request) {
  if (!mcpEnabled()) return Response.json({ error: 'mcp_disabled' }, { status: 503 });
  if (!verifyMcp(req.headers, '')) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED' },
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
