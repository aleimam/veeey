import 'dotenv/config'; // tsx doesn't auto-load .env — load it for the standalone run
import { seedStandardAttributes } from '@/lib/attribute-seed';
import { prisma } from '@/lib/prisma';

/** One-off idempotent seed of the standard catalog attributes (V3-ATTR-4).
 *  Run on the server after deploy: `npx tsx scripts/seed-attributes.ts`. */
async function main() {
  const r = await seedStandardAttributes();
  console.log(`[seed-attributes] attributes: +${r.attributesCreated} created, ${r.attributesExisting} already present; values: +${r.valuesCreated} created`);
  await prisma.$disconnect();
}

void main();
