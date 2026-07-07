import { navFontResolve, type NavConfig } from '@/lib/nav-config';
import { googleFontsHref } from '@/lib/theme';

/** Loads the nav's chosen Google font (if any) — the header applies the family,
 *  this fetches it. No-op for the site presets / already-bundled families. */
export function NavFontLink({ nav }: { nav: NavConfig }) {
  const family = navFontResolve(nav.fontFamily).googleFamily;
  const href = family ? googleFontsHref([family]) : null;
  return href ? <link rel="stylesheet" href={href} /> : null;
}
