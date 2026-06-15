import { setRequestLocale } from 'next-intl/server';
import { listReviews } from '@/lib/review-service';
import { moderateReviewAction, regenSummaryAction } from '@/server/admin-play-actions';
import { aiConfigured } from '@/lib/provider-config';
import { StatusBadge } from '@/components/admin/ui';
import { pick } from '@/lib/admin-i18n';

export default async function AdminReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tb = pick(locale);
  const reviews = await listReviews();
  const ai = await aiConfigured();

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">{tb('Reviews', 'المراجعات')} ({reviews.length})</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">{tb('Product', 'المنتج')}</th><th className="p-3">{tb('Rating', 'التقييم')}</th><th className="p-3 text-start">{tb('Review', 'المراجعة')}</th><th className="p-3">{tb('Media', 'الوسائط')}</th><th className="p-3">{tb('Status', 'الحالة')}</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="p-3 font-medium">{r.product.nameEn}</td>
                <td className="p-3 text-center">{r.rating}★</td>
                <td className="p-3 text-muted-foreground">{r.title ? <span className="font-medium text-foreground">{r.title}. </span> : null}{r.body}</td>
                <td className="p-3 text-center">{r.media.length || '—'}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-end">
                  <div className="flex flex-col items-end gap-1">
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <form action={moderateReviewAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="APPROVED" /><button className="text-xs text-primary hover:underline">{tb('Approve', 'قبول')}</button></form>
                        <form action={moderateReviewAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="REJECTED" /><button className="text-xs text-destructive hover:underline">{tb('Reject', 'رفض')}</button></form>
                      </div>
                    )}
                    <form action={regenSummaryAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="productId" value={r.product.id} />
                      <button disabled={!ai} className="text-xs text-muted-foreground hover:text-primary disabled:opacity-40">✨ {tb('AI summary', 'ملخّص بالذكاء الاصطناعي')}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{tb('No reviews yet.', 'لا توجد مراجعات بعد.')}</td></tr>}
          </tbody>
        </table>
      </div>
      {!ai && <p className="mt-3 text-xs text-muted-foreground">{tb('Set ANTHROPIC_API_KEY to enable AI review summaries.', 'قم بتعيين ANTHROPIC_API_KEY لتفعيل ملخّصات المراجعات بالذكاء الاصطناعي.')}</p>}
    </div>
  );
}
