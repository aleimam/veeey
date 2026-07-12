'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { logClientErrorAction } from '@/server/error-actions';

/** Branded runtime-error boundary (logs to the system error log when enabled). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientErrorAction({
      message: error.message || 'runtime error',
      stack: error.stack,
      source: typeof window !== 'undefined' ? window.location.pathname : undefined,
    }).catch(() => {});
  }, [error]);

  return (
    <div className="veeey-shop flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-heading text-5xl font-bold text-green-dark">⚠</p>
      <h1 className="text-xl font-semibold text-ink">Something went wrong · حدث خطأ ما</h1>
      <p className="max-w-md text-sm text-[color:var(--text-muted)]">
        Sorry — an unexpected error occurred. Our team has been notified.
        <br />
        نعتذر — حدث خطأ غير متوقع، وقد تم إبلاغ فريقنا.
      </p>
      <div className="mt-2 flex gap-3">
        <button onClick={() => reset()} className="v-btn v-btn--primary">Try again · حاول مجددًا</button>
        <Link href="/" className="v-btn v-btn--ghost">Home · الرئيسية</Link>
      </div>
    </div>
  );
}
