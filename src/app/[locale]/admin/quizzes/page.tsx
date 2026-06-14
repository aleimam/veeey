import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { generateQuizAction, toggleQuizPublishedAction } from '@/server/admin-play-actions';
import { aiEnabled } from '@/lib/ai';
import { inputCls, StatusBadge } from '@/components/admin/ui';

export default async function AdminQuizzesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const quizzes = await prisma.quiz.findMany({ orderBy: { createdAt: 'desc' } });
  const ai = aiEnabled();

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">Quizzes ({quizzes.length})</h1>

      <form action={generateQuizAction} className="mb-6 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="locale" value={locale} />
        <label className="text-sm font-medium">Generate a quiz with AI
          <input name="topic" placeholder="e.g. Vitamin D myths" className={`${inputCls} w-72`} />
        </label>
        <button disabled={!ai} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">✨ Generate (draft)</button>
        {!ai && <span className="text-xs text-muted-foreground">Set ANTHROPIC_API_KEY to enable AI generation.</span>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">Title</th><th className="p-3 text-start">Kind</th><th className="p-3 text-start">Published</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {quizzes.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="p-3 font-medium">{q.titleEn}</td>
                <td className="p-3 text-muted-foreground">{q.kind}</td>
                <td className="p-3"><StatusBadge status={q.published ? 'PUBLISHED' : 'DRAFT'} /></td>
                <td className="p-3 text-end">
                  <div className="flex items-center justify-end gap-3">
                    {q.published && <a href={`/${locale}/play/${q.slug}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>}
                    <form action={toggleQuizPublishedAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={q.id} />
                      <button className="text-xs text-primary hover:underline">{q.published ? 'Unpublish' : 'Publish'}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {quizzes.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No quizzes yet — generate one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
