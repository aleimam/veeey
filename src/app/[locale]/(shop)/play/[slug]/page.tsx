import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getQuiz } from '@/lib/play-service';
import { submitQuizAction } from '@/server/play-actions';

type SP = Record<string, string | string[] | undefined>;
type QuizQuestion = { q: string; options: string[] };

export default async function QuizPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SP> }) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const quiz = await getQuiz(slug);
  if (!quiz || !quiz.published) notFound();

  const done = (Array.isArray(sp.done) ? sp.done[0] : sp.done) === '1';
  const questions = (quiz.questionsJson as QuizQuestion[] | null) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{quiz.titleEn}</h1>

      {done ? (
        <div className="mt-6 rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-lg font-medium">Thanks for playing! 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">Your answers were recorded.</p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <Link href={`/play/${slug}`} className="text-primary hover:underline">Play again</Link>
            <Link href="/play" className="text-primary hover:underline">More in Play</Link>
          </div>
        </div>
      ) : (
        <form action={submitQuizAction} className="mt-6 space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="quizId" value={quiz.id} />
          {questions.map((q, i) => (
            <fieldset key={i} className="rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-semibold">{i + 1}. {q.q}</legend>
              <div className="mt-2 space-y-2">
                {q.options.map((o, j) => (
                  <label key={j} className="flex items-center gap-2 text-sm">
                    <input type="radio" name={`q_${i}`} value={o} defaultChecked={j === 0} /> {o}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {questions.length === 0 && <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>}
          <button className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Submit answers</button>
        </form>
      )}
    </div>
  );
}
