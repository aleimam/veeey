import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireFeature } from '@/lib/feature-service';
import { getQuiz } from '@/lib/play-service';
import { submitQuizAction } from '@/server/play-actions';

type SP = Record<string, string | string[] | undefined>;
type QuizQuestion = { q: string; qAr?: string; options: string[]; optionsAr?: string[] };

export default async function QuizPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SP> }) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireFeature('quizzes', locale);
  const quiz = await getQuiz(slug);
  if (!quiz || !quiz.published) notFound();

  const done = (Array.isArray(sp.done) ? sp.done[0] : sp.done) === '1';
  const questions = (quiz.questionsJson as QuizQuestion[] | null) ?? [];
  const ar = locale === 'ar';
  const title = (ar && quiz.titleAr) || quiz.titleEn;
  const t = await getTranslations('storefront.quizPage');

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-green-dark">{title}</h1>

      {done ? (
        <div className="mt-6 rounded-[12px] border border-[color:var(--green-dark-12)] bg-green-wash p-6 text-center">
          <p className="text-lg font-bold text-green-dark">{t('thanks')}</p>
          <p className="mt-1 text-sm text-ink">{t('recorded')}</p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <Link href={`/play/${slug}`} className="font-semibold text-green-dark hover:text-lime-press">{t('playAgain')}</Link>
            <Link href="/play" className="font-semibold text-green-dark hover:text-lime-press">{t('morePlay')}</Link>
          </div>
        </div>
      ) : (
        <form action={submitQuizAction} className="mt-6 space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="quizId" value={quiz.id} />
          {questions.map((q, i) => (
            <fieldset key={i} className="rounded-[12px] border border-[color:var(--slate-border)] p-4">
              <legend className="px-1 text-sm font-semibold text-ink">{i + 1}. {(ar && q.qAr) || q.q}</legend>
              <div className="mt-2 space-y-2">
                {q.options.map((o, j) => (
                  <label key={j} className="flex items-center gap-2 text-sm text-ink">
                    <input type="radio" name={`q_${i}`} value={o} defaultChecked={j === 0} className="accent-[color:var(--green-dark)]" /> {(ar && q.optionsAr?.[j]) || o}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {questions.length === 0 && <p className="text-sm text-[color:var(--text-muted)]">{t('noQuestions')}</p>}
          <button className="v-btn v-btn--primary">{t('submitAnswers')}</button>
        </form>
      )}
    </div>
  );
}
