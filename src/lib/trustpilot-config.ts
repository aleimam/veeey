/**
 * Trustpilot TrustBox configuration (pure — no DB/auth; unit-tested). The service
 * layer (trustpilot-service.ts) persists it as the JSON Setting `trustpilot.config`.
 * Nothing renders until `businessUnitId` is set, so the widget is inert until the
 * owner connects a Trustpilot account. Placements: homepage, footer, checkout.
 */

export type TpPlacement = 'home' | 'footer' | 'checkout';

/** Official Trustpilot TrustBox template ids + a sensible default height (px). */
export const TP_TEMPLATES: { id: string; en: string; ar: string; height: number }[] = [
  { id: '5419b732fbfb950b10de65e5', en: 'Micro star', ar: 'نجوم مصغّرة', height: 24 },
  { id: '5419b6a8b0d04a076446a9ad', en: 'Micro review count', ar: 'عدّاد المراجعات', height: 24 },
  { id: '5406e65db0d04a09e042d5fc', en: 'Horizontal', ar: 'أفقي', height: 28 },
  { id: '56278e9abfbbba0bdcd568bc', en: 'Review collector', ar: 'جامع المراجعات', height: 52 },
  { id: '53aa8807dec7e10d38f59f32', en: 'Mini', ar: 'مصغّر', height: 150 },
  { id: '53aa8912dec7e10d38f59f36', en: 'Carousel', ar: 'شريط متحرك', height: 240 },
];
const TEMPLATE_IDS = new Set(TP_TEMPLATES.map((t) => t.id));

export type TpPlacementCfg = { enabled: boolean; template: string; height: number };
export type TrustpilotConfig = {
  businessUnitId: string;
  domain: string; // review-link domain, e.g. veeey.com
  locale: string; // Trustpilot locale, e.g. en-US / ar-EG
  theme: 'light' | 'dark';
  home: TpPlacementCfg;
  footer: TpPlacementCfg;
  checkout: TpPlacementCfg;
};

export function defaultTrustpilotConfig(): TrustpilotConfig {
  return {
    businessUnitId: '',
    domain: '',
    locale: 'en-US',
    theme: 'light',
    home: { enabled: true, template: '53aa8912dec7e10d38f59f36', height: 240 }, // carousel
    footer: { enabled: true, template: '5419b732fbfb950b10de65e5', height: 24 }, // micro star
    checkout: { enabled: true, template: '5419b732fbfb950b10de65e5', height: 24 }, // micro star
  };
}

const str = (v: unknown, d = '') => (typeof v === 'string' ? v.trim() : d);
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : d);

function normPlacement(raw: unknown, fallback: TpPlacementCfg): TpPlacementCfg {
  const r = (raw ?? {}) as Record<string, unknown>;
  const template = TEMPLATE_IDS.has(str(r.template)) ? str(r.template) : fallback.template;
  return { enabled: r.enabled !== false, template, height: num(r.height, fallback.height) };
}

export function normalizeTrustpilot(raw: unknown): TrustpilotConfig {
  const d = defaultTrustpilotConfig();
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    businessUnitId: str(r.businessUnitId),
    domain: str(r.domain).replace(/^https?:\/\//, '').replace(/\/$/, ''),
    locale: str(r.locale) || d.locale,
    theme: r.theme === 'dark' ? 'dark' : 'light',
    home: normPlacement(r.home, d.home),
    footer: normPlacement(r.footer, d.footer),
    checkout: normPlacement(r.checkout, d.checkout),
  };
}

/** Widget renders only when a Business Unit ID is present. */
export function tpConfigured(cfg: TrustpilotConfig): boolean {
  return cfg.businessUnitId.length > 0;
}

/** Should the widget show at this placement? */
export function tpShows(cfg: TrustpilotConfig, placement: TpPlacement): boolean {
  return tpConfigured(cfg) && cfg[placement].enabled;
}
