/**
 * Veeey theme tokens — the single source of truth for the admin "Appearance"
 * editor and for runtime injection. Each token maps to a CSS custom property the
 * storefront already consumes (see globals.css / veeey-components.css). Overrides
 * are stored as a JSON map (cssVar → value) in the `theme.tokens` Setting and
 * injected on the `.veeey-shop` scope, so they cascade across the whole
 * storefront while the admin panel (no `.veeey-shop` ancestor) is untouched.
 *
 * This module is PURE (no server imports) so the admin live-preview client can
 * import the token list too.
 */

export type ThemeGroup = 'Colors' | 'Typography' | 'Spacing' | 'Radii' | 'Shadows' | 'Motion';
export type ThemeControl = 'color' | 'size' | 'number' | 'text' | 'shadow' | 'font';

export type ThemeToken = {
  /** CSS custom property name, incl. leading `--`. */
  v: string;
  label: string;
  group: ThemeGroup;
  /** Optional sub-grouping within a group (e.g. color families). */
  sub?: string;
  control: ThemeControl;
  /** Default value — the current design-system value (full CSS value, or a font family name for `font`). */
  def: string;
  /** For `font` tokens: the fallback stack appended after the chosen family. */
  fallback?: string;
  hint?: string;
};

export const THEME_GROUPS: ThemeGroup[] = ['Colors', 'Typography', 'Spacing', 'Radii', 'Shadows', 'Motion'];

/** Bundled / local font families that must NOT be requested from Google Fonts. */
export const LOCAL_FONTS = new Set(['GE SS Unique', 'GE Dinar Two', 'Playfair Display', 'Montserrat']);

export const THEME_TOKENS: ThemeToken[] = [
  // ── Colors · Greens ──
  { v: '--green-dark', label: 'Dark green (primary)', group: 'Colors', sub: 'Greens', control: 'color', def: '#38764d' },
  { v: '--green-mid', label: 'Mid green', group: 'Colors', sub: 'Greens', control: 'color', def: '#48884d' },
  { v: '--green-emerald', label: 'Emerald (CTA)', group: 'Colors', sub: 'Greens', control: 'color', def: '#235c3c' },
  { v: '--green-wash', label: 'Green wash', group: 'Colors', sub: 'Greens', control: 'color', def: '#e7f0ea' },
  { v: '--green-deepest', label: 'Deepest green (hero gradient)', group: 'Colors', sub: 'Greens', control: 'color', def: '#1c4a30' },
  // ── Colors · Lime ──
  { v: '--lime', label: 'Lime (accent)', group: 'Colors', sub: 'Lime', control: 'color', def: '#d1d725' },
  { v: '--lime-hover', label: 'Lime hover', group: 'Colors', sub: 'Lime', control: 'color', def: '#bcc121' },
  { v: '--lime-press', label: 'Lime press', group: 'Colors', sub: 'Lime', control: 'color', def: '#a7ac1e' },
  { v: '--lime-wash', label: 'Lime wash', group: 'Colors', sub: 'Lime', control: 'color', def: '#f4f6d9' },
  // ── Colors · Gold ──
  { v: '--gold', label: 'Gold', group: 'Colors', sub: 'Gold', control: 'color', def: '#ffc000' },
  { v: '--gold-deep', label: 'Gold deep', group: 'Colors', sub: 'Gold', control: 'color', def: '#c99700' },
  { v: '--gold-wash', label: 'Gold wash', group: 'Colors', sub: 'Gold', control: 'color', def: '#fff4d6' },
  { v: '--gold-select', label: 'Select gold (Veeey Select)', group: 'Colors', sub: 'Gold', control: 'color', def: '#c9a227' },
  { v: '--gold-on', label: 'Text on gold', group: 'Colors', sub: 'Gold', control: 'color', def: '#1c2f24' },
  // ── Colors · Neutrals ──
  { v: '--slate', label: 'Slate (body text)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#33424f' },
  { v: '--slate-70', label: 'Slate 70 (muted)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#5c6772' },
  { v: '--slate-45', label: 'Slate 45 (subtle)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#8b939c' },
  { v: '--ink', label: 'Ink (headings)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#1c2530' },
  { v: '--surface', label: 'Surface (page/card bg)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#f4f6f3' },
  { v: '--surface-sunk', label: 'Surface sunk', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#ebefea' },
  { v: '--panel-dark', label: 'Dark panel (special order)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#2a3340' },
  { v: '--wash-cool', label: 'Cool wash (device tint)', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#e9eef4' },
  { v: '--surface-card', label: 'Card background', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#ffffff', hint: 'Default card/panel background.' },
  { v: '--link-color', label: 'Link colour', group: 'Colors', sub: 'Neutrals', control: 'color', def: '#38764d', hint: 'Links inside rich content.' },
  // ── Colors · Status ──
  { v: '--success', label: 'Success', group: 'Colors', sub: 'Status', control: 'color', def: '#2f855a' },
  { v: '--warning', label: 'Warning', group: 'Colors', sub: 'Status', control: 'color', def: '#e9a800' },
  { v: '--error', label: 'Error', group: 'Colors', sub: 'Status', control: 'color', def: '#e74c3c' },
  { v: '--info', label: 'Info', group: 'Colors', sub: 'Status', control: 'color', def: '#4e7ac7' },

  // ── Typography · Fonts (any Google font by name; leave blank to keep the brand default) ──
  { v: '--font-display', label: 'Display font (headings)', group: 'Typography', sub: 'Fonts', control: 'font', def: 'Playfair Display', fallback: 'Georgia, serif', hint: 'Latin headings. Any Google font name.' },
  { v: '--font-body', label: 'Body font', group: 'Typography', sub: 'Fonts', control: 'font', def: 'Montserrat', fallback: 'system-ui, sans-serif', hint: 'Latin body + UI. Any Google font name.' },
  { v: '--font-arabic-display', label: 'Arabic display font', group: 'Typography', sub: 'Fonts', control: 'font', def: 'GE SS Unique', fallback: "'Cairo', sans-serif", hint: 'Arabic headings.' },
  { v: '--font-arabic-body', label: 'Arabic body font', group: 'Typography', sub: 'Fonts', control: 'font', def: 'GE Dinar Two', fallback: "'Cairo', sans-serif", hint: 'Arabic body + UI.' },
  // ── Typography · Sizes ──
  { v: '--fs-display', label: 'Display size', group: 'Typography', sub: 'Sizes', control: 'size', def: '64px' },
  { v: '--fs-h1', label: 'H1 size', group: 'Typography', sub: 'Sizes', control: 'size', def: '48px' },
  { v: '--fs-h2', label: 'H2 size', group: 'Typography', sub: 'Sizes', control: 'size', def: '36px' },
  { v: '--fs-h3', label: 'H3 size', group: 'Typography', sub: 'Sizes', control: 'size', def: '28px' },
  { v: '--fs-h4', label: 'H4 size', group: 'Typography', sub: 'Sizes', control: 'size', def: '20px' },
  { v: '--fs-body', label: 'Body size', group: 'Typography', sub: 'Sizes', control: 'size', def: '16px' },
  { v: '--fs-caption', label: 'Caption size', group: 'Typography', sub: 'Sizes', control: 'size', def: '14px' },
  { v: '--fs-overline', label: 'Overline size', group: 'Typography', sub: 'Sizes', control: 'size', def: '12px' },
  { v: '--fs-button', label: 'Button text size', group: 'Typography', sub: 'Sizes', control: 'size', def: '16px' },
  // ── Typography · Weights ──
  { v: '--fw-medium', label: 'Weight — medium', group: 'Typography', sub: 'Weights', control: 'number', def: '500' },
  { v: '--fw-semibold', label: 'Weight — semibold', group: 'Typography', sub: 'Weights', control: 'number', def: '600' },
  { v: '--fw-bold', label: 'Weight — bold', group: 'Typography', sub: 'Weights', control: 'number', def: '700' },
  // ── Typography · Rhythm ──
  { v: '--lh-heading', label: 'Heading line-height', group: 'Typography', sub: 'Rhythm', control: 'number', def: '1.25' },
  { v: '--lh-body', label: 'Body line-height', group: 'Typography', sub: 'Rhythm', control: 'number', def: '1.5' },
  { v: '--ls-overline', label: 'Overline letter-spacing', group: 'Typography', sub: 'Rhythm', control: 'text', def: '0.12em' },

  // ── Spacing ──
  { v: '--space-1', label: 'Space 1', group: 'Spacing', control: 'size', def: '4px' },
  { v: '--space-2', label: 'Space 2', group: 'Spacing', control: 'size', def: '8px' },
  { v: '--space-3', label: 'Space 3', group: 'Spacing', control: 'size', def: '12px' },
  { v: '--space-4', label: 'Space 4', group: 'Spacing', control: 'size', def: '16px' },
  { v: '--space-5', label: 'Space 5', group: 'Spacing', control: 'size', def: '24px' },
  { v: '--space-6', label: 'Space 6', group: 'Spacing', control: 'size', def: '32px' },
  { v: '--space-7', label: 'Space 7', group: 'Spacing', control: 'size', def: '40px' },
  { v: '--space-8', label: 'Space 8', group: 'Spacing', control: 'size', def: '48px' },
  { v: '--space-9', label: 'Space 9', group: 'Spacing', control: 'size', def: '64px' },
  { v: '--container-max', label: 'Container max width', group: 'Spacing', control: 'size', def: '1280px' },

  // ── Radii ──
  { v: '--radius-sm', label: 'Radius small', group: 'Radii', control: 'size', def: '4px' },
  { v: '--radius-md', label: 'Radius medium', group: 'Radii', control: 'size', def: '8px' },
  { v: '--radius-lg', label: 'Radius large', group: 'Radii', control: 'size', def: '12px' },
  { v: '--radius-xl', label: 'Radius x-large', group: 'Radii', control: 'size', def: '16px' },
  { v: '--radius-pill', label: 'Pill radius', group: 'Radii', control: 'size', def: '999px' },
  { v: '--btn-radius', label: 'Button radius', group: 'Radii', control: 'size', def: '999px', hint: 'Button corners. Lower = squarer (e.g. 8px).' },

  // ── Shadows ──
  { v: '--shadow-xs', label: 'Shadow XS', group: 'Shadows', control: 'shadow', def: '0 1px 2px rgba(28, 37, 48, 0.06)' },
  { v: '--shadow-sm', label: 'Shadow SM', group: 'Shadows', control: 'shadow', def: '0 2px 8px rgba(28, 37, 48, 0.07)' },
  { v: '--shadow-md', label: 'Shadow MD', group: 'Shadows', control: 'shadow', def: '0 6px 20px rgba(28, 37, 48, 0.09)' },
  { v: '--shadow-lg', label: 'Shadow LG', group: 'Shadows', control: 'shadow', def: '0 16px 40px rgba(28, 37, 48, 0.12)' },
  { v: '--shadow-card', label: 'Card shadow', group: 'Shadows', control: 'shadow', def: '0 2px 10px rgba(28, 37, 48, 0.06)' },
  { v: '--shadow-card-hover', label: 'Card hover shadow', group: 'Shadows', control: 'shadow', def: '0 10px 28px rgba(28, 37, 48, 0.12)' },
  { v: '--shadow-focus', label: 'Focus ring', group: 'Shadows', control: 'shadow', def: '0 0 0 3px rgba(209, 215, 37, 0.35)' },

  // ── Motion ──
  { v: '--dur-fast', label: 'Duration fast', group: 'Motion', control: 'text', def: '150ms' },
  { v: '--dur-base', label: 'Duration base', group: 'Motion', control: 'text', def: '200ms' },
  { v: '--dur-slow', label: 'Duration slow', group: 'Motion', control: 'text', def: '300ms' },
  { v: '--ease-standard', label: 'Ease standard', group: 'Motion', control: 'text', def: 'cubic-bezier(0.4, 0, 0.2, 1)' },
];

export const THEME_TOKEN_KEYS = new Set(THEME_TOKENS.map((t) => t.v));
const TOKEN_BY_KEY = new Map(THEME_TOKENS.map((t) => [t.v, t] as const));

/** Map of cssVar → default value (full CSS value; font tokens hold the family name). */
export const THEME_DEFAULTS: Record<string, string> = Object.fromEntries(THEME_TOKENS.map((t) => [t.v, t.def]));

export type ThemeOverrides = Record<string, string>;

/**
 * Compose injected CSS (scoped to `.veeey-shop`) + the Google-Fonts families to
 * load, from a sparse overrides map. Only overridden tokens are emitted; unset
 * tokens fall back to the static design-system defaults in globals.css. Pure.
 */
export function composeTheme(overrides: ThemeOverrides): { css: string; fonts: string[] } {
  const decls: string[] = [];
  const fonts: string[] = [];
  for (const [key, raw] of Object.entries(overrides)) {
    const tok = TOKEN_BY_KEY.get(key);
    if (!tok) continue;
    const val = String(raw ?? '').trim();
    if (!val || val === tok.def) continue;
    if (tok.control === 'font') {
      decls.push(`${key}:'${val.replace(/['"\\;]/g, '')}',${tok.fallback ?? 'sans-serif'};`);
      if (!LOCAL_FONTS.has(val)) fonts.push(val);
    } else {
      // basic hardening: CSS values can't contain braces/semicolons here
      decls.push(`${key}:${val.replace(/[{};]/g, '')};`);
    }
  }
  const css = decls.length ? `.veeey-shop{${decls.join('')}}` : '';
  return { css, fonts };
}

/** Build a single Google Fonts stylesheet URL for the given families (or null). */
export function googleFontsHref(fonts: string[]): string | null {
  const uniq = Array.from(new Set(fonts.filter(Boolean)));
  if (!uniq.length) return null;
  const families = uniq
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

// ── Contrast (WCAG) — warn on risky foreground/background colour pairs ──
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function channelLum(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
/** WCAG contrast ratio (1–21) between two hex colours, or null if unparseable. */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return null;
  const la = 0.2126 * channelLum(a[0]) + 0.7152 * channelLum(a[1]) + 0.0722 * channelLum(a[2]);
  const lb = 0.2126 * channelLum(b[0]) + 0.7152 * channelLum(b[1]) + 0.0722 * channelLum(b[2]);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Key text/background pairs the storefront relies on. fg/bg are hex literals or `--token` refs. */
export const CONTRAST_CHECKS: { fg: string; bg: string; label: [string, string]; min: number }[] = [
  { fg: '#ffffff', bg: '--green-emerald', label: ['Primary button text', 'نص الزر الأساسي'], min: 4.5 },
  { fg: '#ffffff', bg: '--green-dark', label: ['Dark button / header text', 'نص الزر الداكن أو الهيدر'], min: 4.5 },
  { fg: '--green-dark', bg: '--lime', label: ['Text on lime', 'نص على اللّايم'], min: 4.5 },
  { fg: '--green-dark', bg: '--green-wash', label: ['Text on green wash', 'نص على الأخضر الفاتح'], min: 4.5 },
  { fg: '--slate', bg: '--surface', label: ['Body text on page', 'نص المحتوى على الصفحة'], min: 4.5 },
  { fg: '--green-dark', bg: '#ffffff', label: ['Headings on white', 'العناوين على الأبيض'], min: 4.5 },
  { fg: '--slate', bg: '--gold', label: ['Text on gold (sale chip)', 'نص على الذهبي'], min: 4.5 },
];

export type ContrastResult = { label: [string, string]; ratio: number; min: number; ok: boolean };

/** Evaluate the contrast checks against the effective colours (overrides over defaults). */
export function evaluateContrast(overrides: ThemeOverrides): ContrastResult[] {
  const resolve = (ref: string) => (ref.startsWith('--') ? overrides[ref] ?? THEME_DEFAULTS[ref] ?? '' : ref);
  const out: ContrastResult[] = [];
  for (const c of CONTRAST_CHECKS) {
    const r = contrastRatio(resolve(c.fg), resolve(c.bg));
    if (r == null) continue;
    out.push({ label: c.label, ratio: Math.round(r * 100) / 100, min: c.min, ok: r >= c.min });
  }
  return out;
}
