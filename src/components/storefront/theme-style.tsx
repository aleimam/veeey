import { getThemeOverrides } from '@/lib/theme-service';
import { composeTheme, googleFontsHref } from '@/lib/theme';

/**
 * Injects the admin-configured theme overrides as CSS variables scoped to
 * `.veeey-shop`, plus any Google-Fonts families they chose. Rendered once in the
 * root layout; because it only targets `.veeey-shop`, the admin panel is
 * unaffected. Returns nothing when no overrides are set (storefront uses the
 * static design-system defaults from globals.css).
 */
export async function ThemeStyle() {
  const overrides = await getThemeOverrides();
  const { css, fonts } = composeTheme(overrides);
  if (!css) return null;
  const href = googleFontsHref(fonts);
  return (
    <>
      {href && <link rel="stylesheet" href={href} />}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
