'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { recordPlayEntry } from '@/lib/play-service';
import { recommendFromAnswers } from '@/lib/guided-selling';
import { submitReview } from '@/lib/review-service';
import { askQuestion } from '@/lib/qa-service';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export async function findSupplementAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const answers = { goal: str(fd, 'goal') ?? '', concern: str(fd, 'concern') ?? '', pref: str(fd, 'pref') ?? '' };
  const goals = recommendFromAnswers(answers);
  try { await recordPlayEntry({ result: { type: 'guided_selling', answers, goals } }); } catch { /* best effort */ }
  redirect(`/${locale}/play/find-your-supplement?g=${encodeURIComponent(goals.join(','))}`);
}

export async function submitQuizAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const slug = str(fd, 'slug') ?? '';
  const answers: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith('q_') && typeof v === 'string') answers[k] = v;
  try { await recordPlayEntry({ quizId: str(fd, 'quizId') ?? null, result: { answers } }); } catch { /* best effort */ }
  redirect(`/${locale}/play/${slug}?done=1`);
}

export async function submitReviewAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const slug = str(fd, 'slug') ?? '';
  try {
    await submitReview({
      productId: str(fd, 'productId') ?? '',
      rating: str(fd, 'rating') ?? '5',
      title: str(fd, 'title'),
      body: str(fd, 'body'),
      media: (str(fd, 'media') ?? '').split(/\s+/).filter((u) => /^https?:\/\//.test(u)),
    });
  } catch { /* validation/ignore */ }
  revalidatePath(`/${locale}/products/${slug}`);
  redirect(`/${locale}/products/${slug}?review=submitted`);
}

/** Public "ask a question" from the PDP — lands PENDING for moderation. */
export async function askQuestionAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const slug = str(fd, 'slug') ?? '';
  try {
    await askQuestion({
      productId: str(fd, 'productId') ?? '',
      askerName: str(fd, 'askerName'),
      question: str(fd, 'question') ?? '',
    });
  } catch { /* validation/ignore */ }
  revalidatePath(`/${locale}/products/${slug}`);
  redirect(`/${locale}/products/${slug}?question=submitted#qa`);
}
