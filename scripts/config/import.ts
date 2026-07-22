import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { prisma } from '@/lib/prisma';
import { CONFIG_TABLES, isSecretSettingKey, keyOf, remapRefs, summarize, type ExportFile } from '@/lib/config-transfer';
import { refDictionary } from '@/lib/config-refs';

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
  const refs = await refDictionary();
  let skippedSecrets = 0;
  let unkeyable = 0;
  let demoted = 0;

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
    for (const source of rows) {
      // Belt and braces: the exporter redacts, and the importer refuses anyway.
      if (t.model === 'setting' && isSecretSettingKey(String(source.key))) { skippedSecrets++; continue; }
      const where = keyOf(source, t.key);
      if (Object.values(where).some((v) => v == null)) { unkeyable++; continue; }

      // Natural keys back into THIS store's ids. Anything this store does not
      // have (a category that was never created here) demotes the row instead of
      // publishing a page that would match nothing.
      const { row, unresolved } = remapRefs(source, t.portable, refs.toId);
      const demote = t.portable?.demoteWhenUnresolved;
      if (unresolved.length && demote) {
        row[demote.field] = demote.value;
        demoted++;
        console.log(`    ⚠️ ${t.model} ${String(where[t.key[0]])} → ${demote.field}=${demote.value}; unresolved here: ${unresolved.slice(0, 4).join(', ')}`);
      }

      // Split relation arrays out of the scalar payload and turn them into
      // `set` — `set` rather than `connect` so a permission REMOVED at the
      // source is also removed here; otherwise an import could only ever widen
      // access, never narrow it.
      const data: Record<string, unknown> = { ...row };
      const rel: Record<string, unknown> = {};
      for (const c of t.connect ?? []) {
        const linked = data[c.field];
        delete data[c.field];
        if (!Array.isArray(linked)) continue;
        let values = linked.map((l) => (l as Record<string, unknown>)[c.on]);
        if (c.kind) {
          // Prisma's `set` throws on the FIRST missing target, taking the whole
          // import down over one product this store happens not to carry.
          const before = values.length;
          values = values.filter((v) => typeof v === 'string' && refs.toId(c.kind!, v) !== null);
          if (values.length !== before) console.log(`    ⚠️ ${t.model} ${String(where[t.key[0]])}: ${before - values.length} ${c.kind}(s) not on this store, link skipped`);
        }
        rel[c.field] = { set: values.map((v) => ({ [c.on]: v })) };
      }

      const existing = await client.findFirst({ where });
      if (existing) {
        updated++;
        if (commit) await client.update!({ where, data: { ...data, ...rel } });
      } else {
        created++;
        if (commit) await client.create!({ data: { ...data, ...rel } });
      }
    }
    applied[t.model] = created + updated;
    console.log(`  ${t.label.padEnd(52)} ${String(created).padStart(4)} new  ${String(updated).padStart(4)} updated`);
  }

  console.log(`\n  ${summarize(applied)}`);
  if (unkeyable) console.log(`  ⚠️ ${unkeyable} row(s) had no usable key and were skipped — the manifest key is wrong for that table.`);
  if (demoted) console.log(`  ⚠️ ${demoted} row(s) referenced something this store does not have and were imported UNPUBLISHED — review them before publishing.`);
  if (skippedSecrets) console.log(`  🔒 ${skippedSecrets} secret setting(s) in the file were refused — set them on this store by hand.`);
  if (file.redactedSettings?.length) {
    console.log(`\n  ⚠️ the source withheld ${file.redactedSettings.length} setting(s) — secrets and per-store provider identity. Configure on this store:`);
    for (const k of file.redactedSettings.sort()) console.log(`     ${k}`);
  }
  console.log(commit ? '\n✅ applied.\n' : '\nℹ️ DRY RUN — nothing written. Re-run with --commit.\n');
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
