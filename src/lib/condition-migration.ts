/**
 * Damaged-goods → Condition field migration (V4 C9), pure parts.
 *
 * Legacy data encodes damage as text in duplicate product NAMES — e.g.
 * "NOW Omega-3 {Broken bottle}" is a separate product row whose lots should
 * really be lots of the base "NOW Omega-3" with lot.condition = BROKEN.
 * These helpers parse the marker and infer the condition; the service layer
 * (condition-migration-service.ts) builds the dry-run plan and applies it.
 */

export type InferredCondition = 'OPEN_BOX' | 'DAMAGED' | 'BROKEN';

/** "Name {Broken bottle}" → { baseName: "Name", condition: 'BROKEN' }; null when
 *  there is no {...} marker or it doesn't describe a packaging condition. */
export function parseConditionMarker(name: string): { baseName: string; condition: InferredCondition } | null {
  const m = name.match(/\{([^}]*)\}/);
  if (!m) return null;
  const marker = m[1].toLowerCase();
  const condition: InferredCondition | null = marker.includes('broken')
    ? 'BROKEN'
    : marker.includes('damag')
      ? 'DAMAGED'
      : marker.includes('open')
        ? 'OPEN_BOX'
        : null;
  if (!condition) return null;
  const baseName = name.replace(/\s*\{[^}]*\}\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (!baseName) return null;
  return { baseName, condition };
}

/** Case/whitespace-insensitive name key for base-product matching. */
export const nameKey = (name: string): string => name.toLowerCase().replace(/\s+/g, ' ').trim();
