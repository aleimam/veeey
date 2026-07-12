import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-guards';
import { hasPermission } from '@/lib/rbac';
import { exchangeCode } from '@/lib/gsc-service';
import { verifyOauthState } from '@/lib/gsc-config';

/**
 * Google OAuth callback for the Search Console connection. Google redirects the
 * admin's browser here with ?code + ?state; we verify the signed state + the
 * admin session, exchange the code for a refresh token, then bounce back to the
 * admin page. (settings.manage-gated; the state HMAC blocks CSRF.)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = `/en/admin/google/search-console`;

  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, 'settings.manage')) {
    return NextResponse.redirect(new URL('/en/login', url));
  }
  if (url.searchParams.get('error')) {
    return NextResponse.redirect(new URL(`${base}?error=${encodeURIComponent(url.searchParams.get('error')!)}`, url));
  }
  if (!verifyOauthState(url.searchParams.get('state'), Date.now())) {
    return NextResponse.redirect(new URL(`${base}?error=bad_state`, url));
  }
  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL(`${base}?error=no_code`, url));

  const r = await exchangeCode(code);
  return NextResponse.redirect(new URL(`${base}?${r.ok ? 'connected=1' : `error=${encodeURIComponent(r.error ?? '1')}`}`, url));
}
