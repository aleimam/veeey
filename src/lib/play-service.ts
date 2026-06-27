import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-guards';
import { recommendFromAnswers } from '@/lib/guided-selling';
import { cardProductInclude, toCardProduct, visibleProductWhere } from '@/lib/storefront';

/** Play section (FR-PLAY-*) + guided-selling (FR-QUIZ-01). */

export const listPublishedQuizzes = () => prisma.quiz.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } });
export const listPublishedGames = () => prisma.game.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } });
export const getQuiz = (slug: string) => prisma.quiz.findUnique({ where: { slug } });

export async function recordPlayEntry(input: { quizId?: string | null; gameId?: string | null; result: unknown }) {
  const user = await getCurrentUser();
  return prisma.playEntry.create({
    data: { customerId: user?.customerId ?? null, quizId: input.quizId ?? null, gameId: input.gameId ?? null, resultJson: input.result as object },
  });
}

/** Map guided-selling answers → recommended published products (by goal category/tag slug). */
export async function guidedSellingRecommend(answers: Record<string, string>, locale: string, limit = 6) {
  const goals = recommendFromAnswers(answers);
  if (goals.length === 0) return [];
  const products = await prisma.product.findMany({
    where: {
      status: 'PUBLISHED',
      AND: [visibleProductWhere],
      OR: [{ categories: { some: { slug: { in: goals } } } }, { tags: { some: { slug: { in: goals } } } }],
    },
    include: cardProductInclude,
    orderBy: { ratingCount: 'desc' },
    take: limit,
  });
  return products.map((p) => toCardProduct(p, locale));
}
