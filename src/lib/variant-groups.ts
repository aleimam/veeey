/**
 * Product variant families — pure logic (no DB/auth imports; unit-tested).
 * A VariantGroup links sibling Products and defines up to MAX_AXES structured
 * axes (Size, Flavor, …). Each member product stores one bilingual value per
 * axis. The PDP renders one chip-row per axis; picking a value navigates to the
 * sibling product that matches it (keeping the other axes when possible).
 */

export const MAX_AXES = 3;

export type VariantAxis = { key: string; nameEn: string; nameAr: string };
/** Per-product axis values: { <axisKey>: { en, ar } }. */
export type VariantValues = Record<string, { en: string; ar: string }>;

export type VariantSibling = {
  id: string;
  slugEn: string;
  slugAr: string | null;
  sort: number;
  inStock: boolean;
  values: VariantValues;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'axis';

/** Normalize stored axesJson → valid axes (≤MAX_AXES, unique keys, named). */
export function normalizeAxes(raw: unknown): VariantAxis[] {
  if (!Array.isArray(raw)) return [];
  const out: VariantAxis[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const a = (r ?? {}) as Record<string, unknown>;
    const nameEn = typeof a.nameEn === 'string' ? a.nameEn.trim() : '';
    if (!nameEn) continue;
    const nameAr = typeof a.nameAr === 'string' && a.nameAr.trim() ? a.nameAr.trim() : nameEn;
    let key = typeof a.key === 'string' && a.key.trim() ? slugify(a.key) : slugify(nameEn);
    while (seen.has(key)) key = `${key}-2`;
    seen.add(key);
    out.push({ key, nameEn, nameAr });
    if (out.length >= MAX_AXES) break;
  }
  return out;
}

/** Normalize a product's stored variantJson against the group's axes. */
export function parseVariantValues(raw: unknown, axes: VariantAxis[]): VariantValues {
  const out: VariantValues = {};
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const axis of axes) {
    const v = (r[axis.key] ?? {}) as Record<string, unknown>;
    const en = typeof v.en === 'string' ? v.en.trim() : '';
    if (!en) continue;
    const ar = typeof v.ar === 'string' && v.ar.trim() ? v.ar.trim() : en;
    out[axis.key] = { en, ar };
  }
  return out;
}

const valueId = (v: { en: string } | undefined) => (v ? v.en.trim().toLowerCase() : '');

/** Pick the sibling to navigate to for axis=value: prefer one that also matches
 *  the current product's OTHER axis values; fall back to any sibling with the
 *  value (lowest sort). Returns null when none exists (chip disabled). */
export function resolveTarget(
  siblings: VariantSibling[],
  axes: VariantAxis[],
  current: VariantSibling,
  axisKey: string,
  value: string,
): VariantSibling | null {
  const want = value.trim().toLowerCase();
  const candidates = siblings
    .filter((s) => valueId(s.values[axisKey]) === want)
    .sort((a, b) => a.sort - b.sort);
  if (candidates.length === 0) return null;
  const otherKeys = axes.map((a) => a.key).filter((k) => k !== axisKey);
  const exact = candidates.find((s) => otherKeys.every((k) => valueId(s.values[k]) === valueId(current.values[k])));
  return exact ?? candidates[0];
}

export type AxisChip = { labelEn: string; labelAr: string; slugEn: string | null; slugAr: string | null; current: boolean; inStock: boolean };
export type AxisRow = { axis: VariantAxis; chips: AxisChip[] };

/** Build the PDP selector rows: one row per axis, one chip per distinct value
 *  (first-seen order by sibling sort). Rows with <2 chips are dropped. */
export function buildAxisRows(axes: VariantAxis[], siblings: VariantSibling[], currentId: string): AxisRow[] {
  const current = siblings.find((s) => s.id === currentId);
  if (!current) return [];
  const ordered = [...siblings].sort((a, b) => a.sort - b.sort);
  const rows: AxisRow[] = [];
  for (const axis of axes) {
    const seen = new Set<string>();
    const chips: AxisChip[] = [];
    for (const s of ordered) {
      const v = s.values[axis.key];
      if (!v) continue;
      const id = valueId(v);
      if (seen.has(id)) continue;
      seen.add(id);
      const target = resolveTarget(siblings, axes, current, axis.key, v.en);
      chips.push({
        labelEn: v.en,
        labelAr: v.ar,
        slugEn: target ? target.slugEn : null,
        slugAr: target ? (target.slugAr ?? target.slugEn) : null,
        current: id === valueId(current.values[axis.key]),
        inStock: target ? target.inStock : false,
      });
    }
    if (chips.length >= 2) rows.push({ axis, chips });
  }
  return rows;
}
