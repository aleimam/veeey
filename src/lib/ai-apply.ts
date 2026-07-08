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

const questionAnswerSchema = z.object({
  id: z.string().min(1),
  answer: z.string().trim().min(1).max(5000),
  status: z.enum(['PUBLISHED', 'HIDDEN']).default('PUBLISHED'),
});

const CONTENT_STATUS = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

const contentUpdateSchema = z
  .object({
    id: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    titleEn: z.string().trim().min(1).max(300).optional(),
    titleAr: z.string().trim().max(300).optional(),
    bodyEn: z.string().trim().max(100_000).optional(),
    bodyAr: z.string().trim().max(100_000).optional(),
    excerptEn: z.string().trim().max(2000).optional(), // blog only; ignored for CMS pages
    excerptAr: z.string().trim().max(2000).optional(),
    metaTitleEn: z.string().trim().max(300).optional(),
    metaTitleAr: z.string().trim().max(300).optional(),
    metaDescEn: z.string().trim().max(500).optional(),
    metaDescAr: z.string().trim().max(500).optional(),
    status: z.enum(CONTENT_STATUS).optional(),
  })
  .refine((d) => d.id || d.slug, { message: 'id or slug required' });

const CMS_FIELDS = ['titleEn', 'titleAr', 'bodyEn', 'bodyAr', 'metaTitleEn', 'metaTitleAr', 'metaDescEn', 'metaDescAr', 'status'] as const;
const BLOG_FIELDS = [...CMS_FIELDS, 'excerptEn', 'excerptAr'] as const;

function pickContentFields(p: z.infer<typeof contentUpdateSchema>, allowed: readonly string[]) {
  const data: Record<string, unknown> = {};
  const touched: string[] = [];
  for (const f of allowed) {
    const v = (p as Record<string, unknown>)[f];
    if (v !== undefined) { data[f] = v; touched.push(f); }
  }
  return { data, touched };
}

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
  'question.answer': async (payload) => {
    const p = questionAnswerSchema.parse(payload);
    const q = await prisma.productQuestion.findUnique({ where: { id: p.id }, select: { id: true } });
    if (!q) return { ok: false, error: 'Question not found' };
    await prisma.productQuestion.update({ where: { id: p.id }, data: { answer: p.answer, status: p.status, answeredAt: new Date() } });
    return { ok: true, summary: `Question ${p.id} answered → ${p.status}` };
  },
  'cms.update': async (payload) => {
    const p = contentUpdateSchema.parse(payload);
    const page = await prisma.cmsPage.findFirst({ where: p.id ? { id: p.id } : { slug: p.slug! }, select: { id: true, slug: true } });
    if (!page) return { ok: false, error: 'CMS page not found' };
    const { data, touched } = pickContentFields(p, CMS_FIELDS);
    if (!touched.length) return { ok: false, error: 'No supported fields to update' };
    await prisma.cmsPage.update({ where: { id: page.id }, data });
    return { ok: true, summary: `Updated page /${page.slug}: ${touched.join(', ')}` };
  },
  'blog.update': async (payload) => {
    const p = contentUpdateSchema.parse(payload);
    const post = await prisma.blogPost.findFirst({ where: p.id ? { id: p.id } : { slug: p.slug! }, select: { id: true, slug: true } });
    if (!post) return { ok: false, error: 'Blog post not found' };
    const { data, touched } = pickContentFields(p, BLOG_FIELDS);
    if (!touched.length) return { ok: false, error: 'No supported fields to update' };
    await prisma.blogPost.update({ where: { id: post.id }, data });
    return { ok: true, summary: `Updated blog /${post.slug}: ${touched.join(', ')}` };
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
