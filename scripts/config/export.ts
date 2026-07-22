import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { CONFIG_TABLES, isSecretSettingKey, stripRow, summarize, type ExportFile } from '@/lib/config-transfer';

/**
 * Export this store's configuration to a JSON file.
 *
 *   npx tsx scripts/config/export.ts                     # → ./config-export-<store>.json
 *   npx tsx scripts/config/export.ts --out /tmp/cfg.json
 *
 * Secrets are REDACTED, never written. The file is safe to copy between stores;
 * it is NOT a backup — business data lives in the database dumps.
 */
const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};

async function main() {
  const store = process.env.INTEGRATION_STORE_KEY || process.env.NEXT_PUBLIC_SITE_URL || 'unknown';
  const out = arg('out') ?? `./config-export-${store.replace(/[^a-z0-9.]+/gi, '-')}.json`;

  const file: ExportFile = {
    version: 1, exportedAt: new Date().toISOString(), sourceStore: store,
    tables: {}, redactedSettings: [], counts: {},
  };

  console.log(`\n=== exporting configuration from ${store} ===\n`);
  for (const t of CONFIG_TABLES) {
    const client = (prisma as unknown as Record<string, { findMany?: (a?: unknown) => Promise<Record<string, unknown>[]> }>)[t.model];
    if (!client?.findMany) { console.log(`  ${t.label.padEnd(52)} — model '${t.model}' not found, skipped`); continue; }

    let rows = await client.findMany();
    if (t.model === 'setting') {
      const before = rows.length;
      const kept: Record<string, unknown>[] = [];
      for (const r of rows) {
        const key = String(r.key);
        if (isSecretSettingKey(key)) file.redactedSettings.push(key);
        else kept.push(r);
      }
      rows = kept;
      console.log(`  ${t.label.padEnd(52)} ${String(rows.length).padStart(5)}  (${before - rows.length} secret(s) redacted)`);
    } else {
      console.log(`  ${t.label.padEnd(52)} ${String(rows.length).padStart(5)}`);
    }
    file.tables[t.model] = rows.map((r) => stripRow(r, t.drop));
    file.counts[t.model] = rows.length;
  }

  writeFileSync(out, JSON.stringify(file, null, 2));
  console.log(`\n  ${summarize(file.counts)}`);
  if (file.redactedSettings.length) {
    console.log(`\n  🔒 REDACTED (re-enter these by hand on the target store):`);
    for (const k of file.redactedSettings.sort()) console.log(`     ${k}`);
  }
  console.log(`\n✅ written to ${out}\n`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
