'use client';

import { useEffect } from 'react';
import { logClientErrorAction } from '@/server/error-actions';

/** Root error boundary (wraps html/body — used when the root layout itself
 *  throws). Logs to the system error log when enabled. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logClientErrorAction({
      message: error.message || 'root error',
      stack: error.stack,
      source: typeof window !== 'undefined' ? window.location.pathname : 'root',
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', color: '#235c3c' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: '#5b6b62', maxWidth: 420 }}>An unexpected error occurred. Please try again.</p>
        <button onClick={() => reset()} style={{ background: '#235c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer' }}>Try again</button>
      </body>
    </html>
  );
}
