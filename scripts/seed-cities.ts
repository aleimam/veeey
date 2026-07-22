import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '@/lib/prisma';

/**
 * Seed the delivery districts behind the checkout "City" dropdown.
 *
 *   npx tsx scripts/seed-cities.ts            # DRY RUN
 *   npx tsx scripts/seed-cities.ts --commit
 *
 * Source: `prisma/data/egypt-cities.json` — 396 districts across the 27
 * governorates, from the public Egypt Post-derived dataset, with governorate
 * names remapped to Veeey's canonical spellings (Gharbiya→Gharbia,
 * Menofia→Monufia, Qaliubiya→Qalyubia, Sharkia→Sharqia, Kafr Al sheikh→Kafr El
 * Sheikh). Committed rather than fetched so a deploy needs no network and the
 * list is reviewable in git.
 *
 * UPSERT by `code`, never delete: staff edits (a renamed district, a
 * deactivated one, a locally added compound) must survive a re-run. Re-seeding
 * repairs missing rows; it does not undo the team's work.
 */
type Row = { code: string; governorate: string; nameEn: string; nameAr: string };

async function main() {
  const commit = process.argv.includes('--commit');
  const rows: Row[] = JSON.parse(readFileSync(join(process.cwd(), 'prisma/data/egypt-cities.json'), 'utf8'));

  const existing = new Map((await prisma.city.findMany({ select: { code: true, nameEn: true, nameAr: true } })).map((c) => [c.code, c]));
  const toCreate = rows.filter((r) => !existing.has(r.code));
  const toUpdate = rows.filter((r) => {
    const e = existing.get(r.code);
    return e && (e.nameEn !== r.nameEn || e.nameAr !== r.nameAr);
  });

  console.log(`\n=== seeding cities — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  console.log(`  file      ${rows.length} districts, ${new Set(rows.map((r) => r.governorate)).size} governorates`);
  console.log(`  in DB     ${existing.size}`);
  console.log(`  create    ${toCreate.length}`);
  console.log(`  rename    ${toUpdate.length}`);
  for (const r of toUpdate.slice(0, 10)) {
    console.log(`     ${r.code}: "${existing.get(r.code)!.nameEn}" → "${r.nameEn}"`);
  }

  if (commit) {
    for (const r of rows) {
      await prisma.city.upsert({
        where: { code: r.code },
        // `active` and `sortOrder` are deliberately absent from the update: they
        // are the two fields staff change, and re-seeding must not revert them.
        update: { governorate: r.governorate, nameEn: r.nameEn, nameAr: r.nameAr },
        create: r,
      });
    }
    console.log(`\n✅ ${rows.length} district(s) upserted.\n`);
  } else {
    console.log('\nℹ️ DRY RUN — nothing written. Re-run with --commit.\n');
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
