import { z } from 'zod';
import { prisma } from '@/lib/prisma';

/**
 * Applier for approved AI proposals (FR-MCP-03). A small, explicit whitelist of
 * write actions — an approved proposal can ONLY do what a handler here allows,
 * with zod-validated payloads. Writes go through the normal prisma client, so
 * the field-level change-log records exactly what the AI changed. Unknown
 * actions are unsupported (can't be applied) rather than a passthrough.
 */
export type ApplyResult = { ok: true; summary: string } | { ok: false; error: string };

const PRODUCT_STATUS = ['DRAFT', 'PUBLISHED', 'PRIVATE', 'ARCHIVED'] as const;

const productUpdateSchema = z
  .object({
    id: z.string().min(1).optional(),
    sku: z.string().min(1).optional(),
    nameEn: z.string().trim().min(1).max(200).optional(),
    nameAr: z.string().trim().max(200).optional(),
    shortDescEn: z.string().trim().max(2000).optional(),
    shortDescAr: z.string().trim().max(2000).optional(),
    longDescEn: z.string().trim().max(20000).optional(),
    longDescAr: z.string().trim().max(20000).optional(),
    priceEgp: z.coerce.number().nonnegative().max(10_000_000).optional(),
    status: z.enum(PRODUCT_STATUS).optional(),
  })
  .refine((d) => d.id || d.sku, { message: 'id or sku required' });

const reviewModerateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['APPROVED', 'REJECTED']),
});

const HANDLERS: Record<string, (payload: unknown) => Promise<ApplyResult>> = {
  'product.update': async (payload) => {
    const p = productUpdateSchema.parse(payload);
    const product = await prisma.product.findFirst({ where: p.id ? { id: p.id } : { sku: p.sku! }, select: { id: true } });
    if (!product) return { ok: false, error: 'Product not found' };
    const data: Record<string, unknown> = {};
    const touched: string[] = [];
    for (const f of ['nameEn', 'nameAr', 'shortDescEn', 'shortDescAr', 'longDescEn', 'longDescAr', 'status'] as const) {
      if (p[f] !== undefined) { data[f] = p[f]; touched.push(f); }
    }
    if (p.priceEgp !== undefined) { data.basePricePiastres = BigInt(Math.round(p.priceEgp * 100)); touched.push('price'); }
    if (!touched.length) return { ok: false, error: 'No supported fields to update' };
    await prisma.product.update({ where: { id: product.id }, data });
    return { ok: true, summary: `Updated product ${p.sku ?? product.id}: ${touched.join(', ')}` };
  },
  'review.moderate': async (payload) => {
    const p = reviewModerateSchema.parse(payload);
    const review = await prisma.review.findUnique({ where: { id: p.id }, select: { id: true } });
    if (!review) return { ok: false, error: 'Review not found' };
    await prisma.review.update({ where: { id: p.id }, data: { status: p.status } });
    return { ok: true, summary: `Review ${p.id} → ${p.status}` };
  },
};

export const SUPPORTED_ACTIONS = Object.keys(HANDLERS);
export const isSupportedAction = (action: string): boolean => action in HANDLERS;

export async function applyAiProposal(action: string, payload: unknown): Promise<ApplyResult> {
  const handler = HANDLERS[action];
  if (!handler) return { ok: false, error: `Unsupported action "${action}". Supported: ${SUPPORTED_ACTIONS.join(', ')}` };
  try {
    return await handler(payload);
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : e instanceof Error ? e.message : 'apply failed';
    return { ok: false, error: msg };
  }
}
