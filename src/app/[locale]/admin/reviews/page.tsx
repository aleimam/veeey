import { setRequestLocale } from 'next-intl/server';
import { listReviews } from '@/lib/review-service';
import { moderateReviewAction, regenSummaryAction } from '@/server/admin-play-actions';
import { aiConfigured } from '@/lib/provider-config';
import { StatusBadge } from '@/components/admin/ui';

export default async function AdminReviewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const reviews = await listReviews();
  const ai = await aiConfigured();

  return (
    <div className="p-6">
      <h1 className="mb-6 font-heading text-xl font-semibold">Reviews ({reviews.length})</h1>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-xs uppercase text-muted-foreground">
            <tr><th className="p-3 text-start">Product</th><th className="p-3">Rating</th><th className="p-3 text-start">Review</th><th className="p-3">Media</th><th className="p-3">Status</th><th className="p-3" /></tr>
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
                        <form action={moderateReviewAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="APPROVED" /><button className="text-xs text-primary hover:underline">Approve</button></form>
                        <form action={moderateReviewAction}><input type="hidden" name="locale" value={locale} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="REJECTED" /><button className="text-xs text-destructive hover:underline">Reject</button></form>
                      </div>
                    )}
                    <form action={regenSummaryAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="productId" value={r.product.id} />
                      <button disabled={!ai} className="text-xs text-muted-foreground hover:text-primary disabled:opacity-40">✨ AI summary</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No reviews yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {!ai && <p className="mt-3 text-xs text-muted-foreground">Set ANTHROPIC_API_KEY to enable AI review summaries.</p>}
    </div>
  );
}
