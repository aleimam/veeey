'use client';

import { usePathname } from 'next/navigation';
import { isAdminPath } from '@/lib/admin-path';

/**
 * Renders its children only outside the admin panel (V6 audit S15).
 *
 * The root layout wraps the third-party loaders (GA4/GTM, PostHog, Clarity) in
 * this, so admin pages ship no marketing or session-replay tags at all — the
 * audit found them firing from /admin/*, and Clarity in particular would have
 * been recording order screens (customer names, phones, addresses) to
 * Microsoft.
 *
 * Uses next/navigation's raw usePathname (locale-prefixed) because this sits
 * OUTSIDE the NextIntlClientProvider in the layout — next-intl's wrapper isn't
 * available there. The children are server components passed straight through;
 * when this returns null on an admin page they never reach the browser.
 *
 * Known residue: a client-side navigation from the storefront INTO the admin
 * cannot unload scripts that already ran. The provider-side guard (no admin
 * events pushed to the dataLayer) covers that path; a direct admin load — the
 * normal case — never loads the tags in the first place.
 */
export function StorefrontOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isAdminPath(pathname)) return null;
  return <>{children}</>;
}
