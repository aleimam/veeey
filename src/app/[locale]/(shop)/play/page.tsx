import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listPublishedQuizzes, listPublishedGames } from '@/lib/play-service';

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [quizzes, games, t] = await Promise.all([listPublishedQuizzes(), listPublishedGames(), getTranslations('storefront.play')]);

  const card = 'rounded-2xl border border-border bg-surface p-5 transition hover:border-primary';
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-foreground">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/play/find-your-supplement" className={`${card} ring-1 ring-primary/30`}>
          <div className="text-xs font-medium uppercase tracking-wide text-primary">{t('guidedQuiz')}</div>
          <div className="mt-1 font-heading text-lg font-semibold">{t('findSupplement')}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t('findSupplementDesc')}</p>
        </Link>

        {quizzes.map((q) => (
          <Link key={q.id} href={`/play/${q.slug}`} className={card}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{q.kind === 'AI_GENERATED' ? t('aiQuiz') : t('quiz')}</div>
            <div className="mt-1 font-heading text-lg font-semibold">{q.titleEn}</div>
          </Link>
        ))}

        {games.map((g) => (
          <div key={g.id} className={`${card} opacity-70`}>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('game')}</div>
            <div className="mt-1 font-heading text-lg font-semibold">{g.titleEn}</div>
            <p className="mt-1 text-sm text-muted-foreground">{t('comingSoon')}</p>
          </div>
        ))}

        {quizzes.length === 0 && games.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('moreSoon')}</p>
        )}
      </div>
    </div>
  );
}
