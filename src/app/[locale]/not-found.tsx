import { headers } from 'next/headers';
import Link from 'next/link';
import { log404Action } from '@/server/error-actions';

/** Branded 404 (logged to the system error log when enabled). */
export default async function NotFound() {
  const h = await headers();
  const path = h.get('x-invoke-path') || h.get('referer') || 'unknown';
  await log404Action(path);

  return (
    <div className="veeey-shop flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-heading text-6xl font-bold text-green-dark">404</p>
      <h1 className="text-xl font-semibold text-ink">Page not found · الصفحة غير موجودة</h1>
      <p className="max-w-md text-sm text-[color:var(--text-muted)]">
        The page you’re looking for doesn’t exist or has moved.
        <br />
        الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
      </p>
      <Link href="/" className="v-btn v-btn--primary mt-2">Back to home · العودة للرئيسية</Link>
    </div>
  );
}
