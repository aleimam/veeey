import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listPublishedQuizzes, listPublishedGames } from '@/lib/play-service';

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [quizzes, games] = await Promise.all([listPublishedQuizzes(), listPublishedGames()]);

  const card = 'rounded-2xl border border-border bg-surface p-5 transition hover:border-primary';
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Veeey Play</h1>
      <p className="mt-1 text-sm text-muted-foreground">Guided picks, quizzes & games — find what fits your wellness goals.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/play/find-your-supplement" className={`${card} ring-1 ring-primary/30`}>
          <div className="text-xs font-medium uppercase tracking-wide text-primary">Guided quiz</div>
          <div className="mt-1 font-heading text-lg font-semibold">Find your supplement</div>
          <p className="mt-1 text-sm text-muted-foreground">Answer 3 questions, get personalized picks.</p>
        </Link>

        {quizzes.map((q) => (
          <Link key={q.id} href={`/play/${q.slug}`} className={card}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{q.kind === 'AI_GENERATED' ? 'AI quiz' : 'Quiz'}</div>
            <div className="mt-1 font-heading text-lg font-semibold">{q.titleEn}</div>
          </Link>
        ))}

        {games.map((g) => (
          <div key={g.id} className={`${card} opacity-70`}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Game</div>
            <div className="mt-1 font-heading text-lg font-semibold">{g.titleEn}</div>
            <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
          </div>
        ))}

        {quizzes.length === 0 && games.length === 0 && (
          <p className="text-sm text-muted-foreground">More quizzes & games are on the way.</p>
        )}
      </div>
    </div>
  );
}
