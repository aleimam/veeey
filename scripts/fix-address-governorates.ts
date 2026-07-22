import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { GOVERNORATES } from '@/lib/governorates';

/**
 * Repair the governorate on imported addresses (owner 2026-07-23).
 *
 *   npx tsx scripts/fix-address-governorates.ts            # DRY RUN + report
 *   npx tsx scripts/fix-address-governorates.ts --commit
 *
 * The WooCommerce import stored WooCommerce's Egypt STATE CODES, so 6,100+ saved
 * addresses read `EGC`, `EGGZ`, `EGALX` — and the storefront prints them
 * literally, because the dropdown matches on the English name. The customer's
 * own address page shows them a code.
 *
 * Two passes, both conservative:
 *   1. CODES — exact, from WooCommerce's own states.php, so unambiguous.
 *      ⚠️ EGBA is Red Sea and EGBH is Beheira; they look swappable and are not.
 *   2. NAMES — Arabic and English spellings of a governorate, only where the
 *      whole value is that governorate and nothing else.
 *
 * Everything else is LEFT ALONE on purpose: `—`, `.`, a phone number, `Amman`,
 * `Dubai`, `تبوك`, free-text street fragments. Those are real data problems and
 * a guess would bury them under a plausible-looking value.
 */

/** WooCommerce Egypt state codes → the canonical English name. */
const CODES: Record<string, string> = {
  EGALX: 'Alexandria', EGASN: 'Aswan', EGAST: 'Assiut', EGBA: 'Red Sea', EGBH: 'Beheira',
  EGBNS: 'Beni Suef', EGC: 'Cairo', EGDK: 'Dakahlia', EGDT: 'Damietta', EGFYM: 'Fayoum',
  EGGH: 'Gharbia', EGGZ: 'Giza', EGIS: 'Ismailia', EGJS: 'South Sinai', EGKB: 'Qalyubia',
  EGKFS: 'Kafr El Sheikh', EGKN: 'Qena', EGLX: 'Luxor', EGMN: 'Minya', EGMNF: 'Monufia',
  EGMT: 'Matrouh', EGPTS: 'Port Said', EGSHG: 'Sohag', EGSHR: 'Sharqia', EGSIN: 'North Sinai',
  EGSUZ: 'Suez', EGWAD: 'New Valley',
};

/** Spelling variants seen in the data. Arabic ة/ه and ا/أ both occur. */
const ALIASES: Record<string, string> = {
  'القاهرة': 'Cairo', 'القاهره': 'Cairo', 'cairo': 'Cairo', 'al qahirah': 'Cairo',
  'الجيزة': 'Giza', 'الجيزه': 'Giza', 'giza': 'Giza',
  'الإسكندرية': 'Alexandria', 'الاسكندرية': 'Alexandria', 'الاسكندريه': 'Alexandria',
  'اسكندرية': 'Alexandria', 'اسكندريه': 'Alexandria', 'alexandria': 'Alexandria',
  'الغربية': 'Gharbia', 'الغربيه': 'Gharbia', 'algharbya': 'Gharbia',
  'الشرقية': 'Sharqia', 'الشرقيه': 'Sharqia',
  'القليوبية': 'Qalyubia', 'القليوبيه': 'Qalyubia',
  'البحيرة': 'Beheira', 'البحيره': 'Beheira',
  'المنوفية': 'Monufia', 'المنوفيه': 'Monufia',
  'الدقهلية': 'Dakahlia', 'الدقهليه': 'Dakahlia',
  'الاسماعيلية': 'Ismailia', 'الاسماعليه': 'Ismailia',
  'اسيوط': 'Assiut', 'أسيوط': 'Assiut',
  'سوهاج': 'Sohag', 'السويس': 'Suez',
};

const GOV_NAMES = new Set(GOVERNORATES.map((g) => g.en));

/** The canonical name for a stored value, or null to leave it alone. */
export function canonicalGovernorate(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (GOV_NAMES.has(v)) return null; // already correct
  const upper = v.toUpperCase();
  if (CODES[upper]) return CODES[upper];
  const hit = ALIASES[v.toLowerCase()];
  return hit ?? null;
}

async function main() {
  const commit = process.argv.includes('--commit');
  const rows = await prisma.address.findMany({ select: { id: true, governorate: true } });

  const changes = new Map<string, { to: string; ids: string[] }>();
  const untouched = new Map<string, number>();
  let alreadyGood = 0;

  for (const r of rows) {
    const to = canonicalGovernorate(r.governorate);
    if (to) {
      const key = r.governorate;
      const e = changes.get(key) ?? { to, ids: [] };
      e.ids.push(r.id);
      changes.set(key, e);
    } else if (GOV_NAMES.has((r.governorate ?? '').trim())) {
      alreadyGood++;
    } else {
      const k = (r.governorate ?? '').trim() || '(blank)';
      untouched.set(k, (untouched.get(k) ?? 0) + 1);
    }
  }

  const total = [...changes.values()].reduce((n, c) => n + c.ids.length, 0);
  console.log(`\n=== address governorates — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  console.log(`  addresses        ${rows.length}`);
  console.log(`  already correct  ${alreadyGood}`);
  console.log(`  to rewrite       ${total}`);
  for (const [from, c] of [...changes].sort((a, b) => b[1].ids.length - a[1].ids.length)) {
    console.log(`     ${from.padEnd(18)} → ${c.to.padEnd(16)} ${c.ids.length}`);
  }
  console.log(`\n  LEFT ALONE (${[...untouched.values()].reduce((a, b) => a + b, 0)} row(s) across ${untouched.size} value(s)) — not guessable:`);
  for (const [v, n] of [...untouched].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`     ${v.slice(0, 40).padEnd(42)} ${n}`);
  }

  if (!commit) {
    console.log('\nℹ️ DRY RUN — nothing written. Re-run with --commit.\n');
  } else {
    // Reversible: the FROM value is the key, so the inverse update is trivial.
    for (const [from, c] of changes) {
      await prisma.address.updateMany({ where: { id: { in: c.ids } }, data: { governorate: c.to } });
      console.log(`  ✔ ${from} → ${c.to} (${c.ids.length})`);
    }
    console.log(`\n✅ ${total} address(es) rewritten.\n`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
