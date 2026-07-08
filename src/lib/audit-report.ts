/** Pure audit-report shape + text rendering (no DB/auth imports — unit-tested).
 *  The service layer (audit-report-service.ts) builds the data and emails it. */

export type AuditReport = {
  from: Date;
  to: Date;
  total: number;
  byEntity: { entity: string; count: number }[];
  topActions: { action: string; count: number }[];
  topActors: { actor: string; count: number }[];
};

const d10 = (d: Date) => d.toISOString().slice(0, 10);

/** Plain-text rendering keeps every mail client happy. */
export function renderAuditReport(r: AuditReport): { subject: string; body: string } {
  const lines: string[] = [
    `Veeey admin activity — ${d10(r.from)} to ${d10(r.to)}`,
    '',
    `Total logged actions: ${r.total}`,
    '',
    'By area:',
    ...(r.byEntity.length ? r.byEntity.map((e) => `  ${e.entity}: ${e.count}`) : ['  (none)']),
    '',
    'Top actions:',
    ...(r.topActions.length ? r.topActions.map((a) => `  ${a.action}: ${a.count}`) : ['  (none)']),
    '',
    'Most active staff:',
    ...(r.topActors.length ? r.topActors.map((a) => `  ${a.actor}: ${a.count}`) : ['  (none)']),
    '',
    'Full detail with field-level diffs: /admin/change-log (filter by date, export CSV).',
  ];
  return { subject: `Veeey weekly activity report — ${d10(r.to)} (${r.total} actions)`, body: lines.join('\n') };
}
