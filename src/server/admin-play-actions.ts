'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { generateQuiz } from '@/lib/ai';
import { moderateReview, regenerateReviewSummary } from '@/lib/review-service';
import { answerQuestion, setQuestionStatus, deleteQuestion } from '@/lib/qa-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'quiz';
const stamp = () => Math.random().toString(36).slice(2, 7);

export async function generateQuizAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const topic = str(fd, 'topic') ?? 'wellness';
  const user = await requirePermission('content.manage');
  const quiz = await generateQuiz(topic, 5);
  if (quiz) {
    const created = await prisma.quiz.create({
      data: { slug: `${slugify(quiz.titleEn)}-${stamp()}`, titleEn: quiz.titleEn, kind: 'AI_GENERATED', questionsJson: quiz.questions, published: false },
    });
    await audit({ actorType: 'USER', actorId: user.id, action: 'quiz.ai_generate', entityType: 'Quiz', entityId: created.id, data: { topic } });
  }
  revalidatePath(`/${locale}/admin/quizzes`);
  redirect(`/${locale}/admin/quizzes?ai=${quiz ? 'ok' : 'off'}`);
}

export async function toggleQuizPublishedAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const user = await requirePermission('content.manage');
  if (id) {
    const q = await prisma.quiz.findUnique({ where: { id } });
    if (q) {
      await prisma.quiz.update({ where: { id }, data: { published: !q.published } });
      await audit({ actorType: 'USER', actorId: user.id, action: 'quiz.publish.toggle', entityType: 'Quiz', entityId: id, data: { published: !q.published } });
    }
  }
  revalidatePath(`/${locale}/admin/quizzes`);
  redirect(`/${locale}/admin/quizzes`);
}

export async function moderateReviewAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const status = str(fd, 'status') as 'APPROVED' | 'REJECTED' | undefined;
  if (id && status) { try { await moderateReview(id, status); } catch (e) { console.error(e); } }
  revalidatePath(`/${locale}/admin/reviews`);
  redirect(`/${locale}/admin/reviews`);
}

// ---- Product Q&A moderation -------------------------------------------------
export async function answerQuestionAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const answer = str(fd, 'answer') ?? '';
  const publish = fd.get('publish') != null;
  if (id) { try { await answerQuestion(id, answer, publish); } catch (e) { console.error(e); } }
  revalidatePath(`/${locale}/admin/questions`);
  redirect(`/${locale}/admin/questions`);
}

export async function setQuestionStatusAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  const status = str(fd, 'status') as 'PENDING' | 'PUBLISHED' | 'HIDDEN' | undefined;
  if (id && status) { try { await setQuestionStatus(id, status); } catch (e) { console.error(e); } }
  revalidatePath(`/${locale}/admin/questions`);
  redirect(`/${locale}/admin/questions`);
}

export async function deleteQuestionAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) { try { await deleteQuestion(id); } catch (e) { console.error(e); } }
  revalidatePath(`/${locale}/admin/questions`);
  redirect(`/${locale}/admin/questions`);
}

export async function regenSummaryAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const productId = str(fd, 'productId');
  if (productId) { try { await regenerateReviewSummary(productId); } catch (e) { console.error(e); } }
  revalidatePath(`/${locale}/admin/reviews`);
  redirect(`/${locale}/admin/reviews`);
}
