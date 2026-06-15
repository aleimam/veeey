import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';

/**
 * Next.js 16 renamed the `middleware` convention to `proxy` (nodejs runtime).
 * This wires next-intl locale negotiation + redirects (`/` -> `/en`). FR-I18N-01.
 *
 * The storefront is bilingual (EN/AR with a switcher); the admin panel is
 * Arabic-only — any `/en/admin…` request is redirected to `/ar/admin…` so staff
 * always get the Arabic, RTL dashboard.
 */
const intl = createMiddleware(routing);

export default function proxy(req: NextRequest) {
  const adminEn = req.nextUrl.pathname.match(/^\/en(\/admin(?:\/.*)?)$/);
  if (adminEn) {
    const url = req.nextUrl.clone();
    url.pathname = `/ar${adminEn[1]}`;
    return NextResponse.redirect(url);
  }
  return intl(req);
}

export const config = {
  // Run on everything except API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
