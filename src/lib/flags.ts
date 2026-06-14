/**
 * Feature-flag / A/B-testing hooks (FR-PLAT-01).
 *
 * Phase-0 scaffold: flags are read from env (`FLAG_<NAME>=on`) and default OFF,
 * honoring AGENTS.md rule "feature behind a flag if incomplete". A later phase
 * (P13) layers an experiment-assignment UI on top of this same surface.
 *
 * Business numbers must never be hard-coded — flags gate *behavior*, not values.
 */

export const FLAGS = {
  // YeldnIN integration ships disabled until the contract is re-baselined (P14).
  INTEGRATION_ENABLED: 'INTEGRATION_ENABLED',
  // Transition mirror (P16) — isolated, removable, ships off.
  TRANSITION_MIRROR: 'TRANSITION_MIRROR',
} as const;

export type FlagKey = keyof typeof FLAGS;

function readFlag(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  return ['1', 'on', 'true', 'yes'].includes(raw.toLowerCase());
}

/** Server-side flag check. Defaults to OFF when unset. */
export function isEnabled(flag: FlagKey): boolean {
  return readFlag(FLAGS[flag]);
}

/** Deterministic A/B bucket (0..buckets-1) for a stable key (e.g. session id). */
export function bucketFor(key: string, buckets = 2): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % buckets;
}
