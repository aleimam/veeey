import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { ATTR_COOKIE, ATTR_MAX_AGE, captureAttribution } from '@/lib/attribution';

/**
 * Next.js 16 renamed the `middleware` convention to `proxy` (nodejs runtime).
 * This wires next-intl locale negotiation + redirects (`/` -> `/en`). FR-I18N-01.
 * Storefront and admin are both fully bilingual (EN/AR with a switcher).
 *
 * It also captures order attribution (owner batch #7): the last non-direct
 * touch (UTM params / ad click-ids / external referrer) is stored in a cookie
 * that checkout snapshots onto Order.utmJson.
 */
const intl = createMiddleware(routing);

export default function proxy(req: NextRequest) {
  const res = intl(req);
  try {
    const touch = captureAttribution(req.nextUrl, req.headers.get('referer'), req.cookies.get(ATTR_COOKIE)?.value);
    if (touch) res.cookies.set(ATTR_COOKIE, touch, { maxAge: ATTR_MAX_AGE, path: '/', sameSite: 'lax' });
  } catch {
    // attribution must never break routing
  }
  return res;
}

export const config = {
  // Run on everything except API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
