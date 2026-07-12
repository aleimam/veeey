/**
 * Auto-fill status helpers (pure — no DB/auth imports; unit-tested). The one-click
 * "auto-fill all filterable attributes" pass runs in the worker and writes its
 * progress to the Setting `attributes.autofillJob`; these helpers parse and
 * reason about that status so the admin page can render it.
 */

export type AutofillStatus = {
  state: 'running' | 'done' | 'error';
  /** Attribute currently being processed (nameEn) — running only. */
  current?: string;
  attrDone: number; // attributes fully processed
  attrTotal: number;
  scanned: number; // products examined (missing this attribute)
  applied: number; // ProductAttributeValue rows written
  skipped: number; // products the AI declined to tag (unsure)
  startedAt: string;
  at: string; // heartbeat — updated after every batch
  error?: string;
};

export function parseAutofillStatus(raw: string | null | undefined): AutofillStatus | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as AutofillStatus;
    if (v && (v.state === 'running' || v.state === 'done' || v.state === 'error')) return v;
  } catch {
    // corrupted status → treat as none
  }
  return null;
}

/** A run counts as active while it heartbeats; a stale "running" (worker died)
 *  should not block a restart forever. */
export function isAutofillActive(status: AutofillStatus | null, now: Date, staleMinutes = 10): boolean {
  if (!status || status.state !== 'running') return false;
  const beat = Date.parse(status.at);
  if (!Number.isFinite(beat)) return false;
  return now.getTime() - beat < staleMinutes * 60_000;
}

/** One-line human summary for the admin card (bilingual handled by caller). */
export function autofillProgressLine(s: AutofillStatus): string {
  const base = `${s.applied} applied · ${s.skipped} skipped · ${s.scanned} scanned`;
  if (s.state === 'running') return `${s.attrDone}/${s.attrTotal} attributes — ${s.current ?? '…'} · ${base}`;
  if (s.state === 'error') return `${base} · ${s.error ?? 'error'}`;
  return `${s.attrTotal} attributes · ${base}`;
}
