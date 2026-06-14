import { readFileSync } from 'node:fs';
import { dryRun, type SourceExport } from '../../src/lib/migration/etl';

/**
 * Migration dry-run runner (P15). `npm run migrate:dry [file]` validates a source
 * export and prints a per-entity report. `--apply` is intentionally gated: the
 * live migration runs sandboxed against the FRESH cutover export (real PII,
 * OUTSIDE this repo per AGENTS.md §3) and is not part of this scaffold.
 */
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const file = args.find((a) => !a.startsWith('--')) ?? 'scripts/migration/sample-export.json';

if (apply) {
  console.error('✋ --apply is gated. The live migration runs sandboxed against the fresh cutover export (real PII, outside this repo per AGENTS.md §3). This tool is dry-run / validation only.');
  process.exit(2);
}

const src = JSON.parse(readFileSync(file, 'utf8')) as SourceExport;
const report = dryRun(src, { now: new Date() });

console.log(`\nMigration dry-run — ${file}`);
console.log('(synthetic fixture; remap field names to the real export at cutover)\n');
for (const r of report.reports) {
  const warn = r.warnings.length ? `  ⚠ ${r.warnings.length}` : '';
  console.log(`${r.entity.padEnd(10)} ${String(r.ok).padStart(4)}/${r.total} ok${warn}`);
  for (const w of r.warnings.slice(0, 20)) console.log(`   - ${w}`);
}
console.log(`\nTotal: ${report.totalOk}/${report.totalRows} rows ok · ${report.totalWarnings} warnings.`);
