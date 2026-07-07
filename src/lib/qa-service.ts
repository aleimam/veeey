import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission, getCurrentUser } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/** Product Q&A ("Answered Questions", audit follow-up). Customers ask on the
 *  PDP; questions land PENDING; staff answer + publish (reviews.moderate).
 *  Only PUBLISHED question+answer pairs render on the storefront. */

const askSchema = z.object({
  productId: z.string().min(1),
  askerName: z.string().trim().max(80).optional(),
  question: z.string().trim().min(5).max(1000),
});
export type AskInput = z.input<typeof askSchema>;

export async function askQuestion(raw: AskInput) {
  const data = askSchema.parse(raw);
  const user = await getCurrentUser();
  return prisma.productQuestion.create({
    data: {
      productId: data.productId,
      customerId: user?.customerId ?? null,
      askerName: data.askerName || user?.name || null,
      question: data.question,
      status: 'PENDING',
    },
  });
}

/** Published Q&A pairs for the PDP (answered only), newest answers first. */
export function publishedQuestions(productId: string, take = 20) {
  return prisma.productQuestion.findMany({
    where: { productId, status: 'PUBLISHED', answer: { not: null } },
    orderBy: [{ answeredAt: 'desc' }, { createdAt: 'desc' }],
    take,
  });
}

export function listQuestions({ status, q }: { status?: string; q?: string } = {}) {
  const where: Prisma.ProductQuestionWhereInput = {};
  if (status) where.status = status;
  if (q) where.OR = [{ question: { contains: q, mode: 'insensitive' } }, { answer: { contains: q, mode: 'insensitive' } }];
  return prisma.productQuestion.findMany({
    where,
    include: { product: { select: { id: true, nameEn: true, slugEn: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export function countPendingQuestions() {
  return prisma.productQuestion.count({ where: { status: 'PENDING' } });
}

/** Save an answer; optionally publish in the same step. */
export async function answerQuestion(id: string, answer: string, publish: boolean) {
  const user = await requirePermission('reviews.moderate');
  const text = answer.trim();
  const row = await prisma.productQuestion.update({
    where: { id },
    data: { answer: text || null, answeredAt: text ? new Date() : null, ...(publish && text ? { status: 'PUBLISHED' } : {}) },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: publish ? 'question.answer.publish' : 'question.answer', entityType: 'ProductQuestion', entityId: id });
  return row;
}

export async function setQuestionStatus(id: string, status: 'PENDING' | 'PUBLISHED' | 'HIDDEN') {
  const user = await requirePermission('reviews.moderate');
  const row = await prisma.productQuestion.update({ where: { id }, data: { status } });
  await audit({ actorType: 'USER', actorId: user.id, action: `question.${status.toLowerCase()}`, entityType: 'ProductQuestion', entityId: id });
  return row;
}

export async function deleteQuestion(id: string) {
  const user = await requirePermission('reviews.moderate');
  await prisma.productQuestion.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'question.delete', entityType: 'ProductQuestion', entityId: id });
}
