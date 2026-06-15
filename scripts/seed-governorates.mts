/**
 * Seed Egypt's 27 governorates as shipping zones (granularity GOVERNORATE).
 * Idempotent: upsert by a stable id; existing rows are left untouched (update:{}),
 * so the demo Cairo/Alexandria zones + their areas are preserved. Edit/add areas
 * afterwards in Admin → Shipping.
 *
 * Run:  DATABASE_URL=... npx tsx scripts/seed-governorates.mts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// id, English name. Cairo/Alexandria reuse the seed's demo zone ids.
const GOVERNORATES: { id: string; name: string }[] = [
  { id: 'zone_cairo', name: 'Cairo' },
  { id: 'gov_giza', name: 'Giza' },
  { id: 'zone_alex', name: 'Alexandria' },
  { id: 'gov_qalyubia', name: 'Qalyubia' },
  { id: 'gov_sharqia', name: 'Sharqia' },
  { id: 'gov_dakahlia', name: 'Dakahlia' },
  { id: 'gov_beheira', name: 'Beheira' },
  { id: 'gov_gharbia', name: 'Gharbia' },
  { id: 'gov_monufia', name: 'Monufia' },
  { id: 'gov_kafrelsheikh', name: 'Kafr El Sheikh' },
  { id: 'gov_damietta', name: 'Damietta' },
  { id: 'gov_portsaid', name: 'Port Said' },
  { id: 'gov_ismailia', name: 'Ismailia' },
  { id: 'gov_suez', name: 'Suez' },
  { id: 'gov_northsinai', name: 'North Sinai' },
  { id: 'gov_southsinai', name: 'South Sinai' },
  { id: 'gov_faiyum', name: 'Faiyum' },
  { id: 'gov_benisuef', name: 'Beni Suef' },
  { id: 'gov_minya', name: 'Minya' },
  { id: 'gov_asyut', name: 'Asyut' },
  { id: 'gov_sohag', name: 'Sohag' },
  { id: 'gov_qena', name: 'Qena' },
  { id: 'gov_luxor', name: 'Luxor' },
  { id: 'gov_aswan', name: 'Aswan' },
  { id: 'gov_redsea', name: 'Red Sea' },
  { id: 'gov_newvalley', name: 'New Valley' },
  { id: 'gov_matrouh', name: 'Matrouh' },
];

async function main() {
  for (const g of GOVERNORATES) {
    await prisma.shippingZone.upsert({
      where: { id: g.id },
      update: {}, // keep existing zones (incl. demo Cairo/Alex + their areas) untouched
      create: { id: g.id, name: g.name, governorate: g.name, granularity: 'GOVERNORATE' },
    });
  }
  console.log(`Ensured ${GOVERNORATES.length} governorate zones.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
