import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { CONFIG_TABLES, isSecretSettingKey, keyOf, summarize, type ExportFile } from '@/lib/config-transfer';

/**
 * Replay a configuration export onto this store.
 *
 *   npx tsx scripts/config/import.ts --file cfg.json            # DRY RUN
 *   npx tsx scripts/config/import.ts --file cfg.json --commit
 *
 * UPSERT, never delete. A row present here but absent from the file is left
 * alone: the file is "what the source had", not "what the target may keep", and
 * deleting on that basis would silently drop anything configured only here.
 *
 * Refuses to write a secret even if one somehow reached the file, so a bad
 * export can never overwrite this store's live credentials with stale ones.
 */
const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};

async function main() {
  const path = arg('file');
  if (!path) { console.error('usage: import.ts --file <export.json> [--commit]'); process.exit(1); }
  const commit = process.argv.includes('--commit');
  const file = JSON.parse(readFileSync(path, 'utf8')) as ExportFile;
  if (file.version !== 1) { console.error(`unsupported export version ${file.version}`); process.exit(1); }

  const store = process.env.INTEGRATION_STORE_KEY || process.env.NEXT_PUBLIC_SITE_URL || 'unknown';
  console.log(`\n=== importing configuration into ${store} — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  console.log(`  source: ${file.sourceStore}   taken: ${file.exportedAt}`);
  if (file.sourceStore === store) console.log('  (same store — this is a restore, not a transfer)');

  const applied: Record<string, number> = {};
  let skippedSecrets = 0;

  for (const t of CONFIG_TABLES) {
    const rows = file.tables[t.model];
    if (!rows?.length) continue;
    const client = (prisma as unknown as Record<string, {
      findFirst?: (a: unknown) => Promise<unknown>;
      update?: (a: unknown) => Promise<unknown>;
      create?: (a: unknown) => Promise<unknown>;
    }>)[t.model];
    if (!client?.findFirst) { console.log(`  ${t.label.padEnd(52)} — model missing on this store, skipped`); continue; }

    let created = 0, updated = 0;
    for (const row of rows) {
      // Belt and braces: the exporter redacts, and the importer refuses anyway.
      if (t.model === 'setting' && isSecretSettingKey(String(row.key))) { skippedSecrets++; continue; }
      const where = keyOf(row, t.key);
      if (Object.values(where).some((v) => v == null)) continue; // unkeyable row
      const existing = await client.findFirst({ where });
      if (existing) {
        updated++;
        if (commit) await client.update!({ where, data: row });
      } else {
        created++;
        if (commit) await client.create!({ data: row });
      }
    }
    applied[t.model] = created + updated;
    console.log(`  ${t.label.padEnd(52)} ${String(created).padStart(4)} new  ${String(updated).padStart(4)} updated`);
  }

  console.log(`\n  ${summarize(applied)}`);
  if (skippedSecrets) console.log(`  🔒 ${skippedSecrets} secret setting(s) in the file were refused — set them on this store by hand.`);
  if (file.redactedSettings?.length) {
    console.log(`\n  ⚠️ the source had ${file.redactedSettings.length} secret(s) that were never exported. Configure on this store:`);
    for (const k of file.redactedSettings.sort()) console.log(`     ${k}`);
  }
  console.log(commit ? '\n✅ applied.\n' : '\nℹ️ DRY RUN — nothing written. Re-run with --commit.\n');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
