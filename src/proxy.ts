import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

/**
 * Next.js 16 renamed the `middleware` convention to `proxy` (nodejs runtime).
 * This wires next-intl locale negotiation + redirects (`/` -> `/en`). FR-I18N-01.
 */
export default createMiddleware(routing);

export const config = {
  // Run on everything except API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
