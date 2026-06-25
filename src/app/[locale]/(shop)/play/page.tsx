import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listPublishedQuizzes, listPublishedGames } from '@/lib/play-service';

export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [quizzes, games, t] = await Promise.all([listPublishedQuizzes(), listPublishedGames(), getTranslations('storefront.play')]);

  const card = 'rounded-[14px] border border-[color:var(--green-dark-05)] bg-white p-5 shadow-[var(--shadow-card)] transition-colors hover:border-green-dark';
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-green-dark">{t('title')}</h1>
      <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('subtitle')}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/play/find-your-supplement" className={`${card} ring-1 ring-[color:var(--green-dark-12)]`}>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-green-mid">{t('guidedQuiz')}</div>
          <div className="mt-1 font-heading text-lg font-semibold text-ink">{t('findSupplement')}</div>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('findSupplementDesc')}</p>
        </Link>

        {quizzes.map((q) => (
          <Link key={q.id} href={`/play/${q.slug}`} className={card}>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">{q.kind === 'AI_GENERATED' ? t('aiQuiz') : t('quiz')}</div>
            <div className="mt-1 font-heading text-lg font-semibold text-ink">{(locale === 'ar' && q.titleAr) || q.titleEn}</div>
          </Link>
        ))}

        {games.map((g) => (
          <div key={g.id} className={`${card} opacity-70`}>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--text-subtle)]">{t('game')}</div>
            <div className="mt-1 font-heading text-lg font-semibold text-ink">{g.titleEn}</div>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{t('comingSoon')}</p>
          </div>
        ))}

        {quizzes.length === 0 && games.length === 0 && (
          <p className="text-sm text-[color:var(--text-muted)]">{t('moreSoon')}</p>
        )}
      </div>
    </div>
  );
}
