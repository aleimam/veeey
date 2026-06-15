/**
 * Synthetic seed (P1). SYNTHETIC DATA ONLY — never real customer/order PII
 * (AGENTS.md golden rule #3). Seeds config that later phases rely on:
 * RBAC roles/permissions (SPEC §17), tiers (FR-PRC-01), shipping types/fees
 * (FR-SHP-07), a default location, a small bilingual catalog with lots + a
 * price-per-expiry sale lot (FR-INV-*), and a couple of notification templates.
 *
 * Idempotent: config is upserted by unique key; catalog is created once (guarded).
 * Run: `DATABASE_URL=... npx tsx prisma/seed.ts`  (or `npm run db:seed`).
 */
import 'dotenv/config'; // tsx doesn't auto-load .env (Next does) — load it for standalone runs
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  PERMISSION_CATALOG,
  ROLE_DEFINITIONS,
  permissionsForRole,
} from '../src/lib/permissions';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// EGP helper -> piastres BigInt
const egp = (amount: number): bigint => BigInt(Math.round(amount * 100));

// RBAC permissions + roles come from the shared catalog (src/lib/permissions.ts),
// the single source of truth shared with runtime RBAC checks (no drift).

// ---- Tiers (renameable, manual) — FR-PRC-01/02 ----------------------------
const TIERS = [
  { key: 'GREEN', nameEn: 'Veeey Green', nameAr: 'فيي جرين', rank: 1, earnRatePerEgp: 1, color: '#48884d' },
  { key: 'VEEEYIP', nameEn: 'VeeeyIP', nameAr: 'فيي آي بي', rank: 2, earnRatePerEgp: 2, color: '#38764d' },
  { key: 'SELECT', nameEn: 'Veeey Select', nameAr: 'فيي سيليكت', rank: 3, earnRatePerEgp: 3, color: '#ffc000' },
];

// ---- Shipping types + fees (admin-configurable) — FR-SHP-07 ---------------
// ⚠️ "UltraFast" brand name is an open decision (#1); label is a placeholder.
const SHIPPING = [
  { type: 'FAST_FREE' as const, feePiastres: egp(0), labelEn: 'Fast & Free', labelAr: 'سريع ومجاني' },
  { type: 'ULTRAFAST' as const, feePiastres: egp(400), labelEn: 'UltraFast (3–6h)', labelAr: 'فائق السرعة (٣–٦ ساعات)' },
  { type: 'PICK_FROM_OFFICE' as const, feePiastres: egp(100), labelEn: 'Pick from Office', labelAr: 'الاستلام من المكتب' },
];

async function seedConfig() {
  // Permissions
  for (const [key, description] of Object.entries(PERMISSION_CATALOG)) {
    await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }
  // Roles + permission links
  for (const role of ROLE_DEFINITIONS) {
    const keys = permissionsForRole(role);
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, permissions: { set: keys.map((key) => ({ key })) } },
      create: { key: role.key, name: role.name, permissions: { connect: keys.map((key) => ({ key })) } },
    });
  }
  // Tiers
  for (const t of TIERS) {
    await prisma.tier.upsert({ where: { key: t.key }, update: t, create: t });
  }
  // Shipping type config
  for (const s of SHIPPING) {
    await prisma.shippingTypeConfig.upsert({ where: { type: s.type }, update: s, create: s });
  }
  // Default location
  await prisma.location.upsert({
    where: { id: 'loc_main' },
    update: {},
    create: { id: 'loc_main', name: 'Main Warehouse', type: 'warehouse', isUltraFastZone: true },
  });
  // Shipping zones + areas (FR-SHP-06): area-level in Greater Cairo, governorate elsewhere.
  await prisma.shippingZone.upsert({ where: { id: 'zone_cairo' }, update: {}, create: { id: 'zone_cairo', name: 'Greater Cairo', governorate: 'Cairo', granularity: 'AREA' } });
  await prisma.shippingZone.upsert({ where: { id: 'zone_alex' }, update: {}, create: { id: 'zone_alex', name: 'Alexandria', governorate: 'Alexandria', granularity: 'GOVERNORATE' } });
  const areas = [
    { id: 'area_nasr', zoneId: 'zone_cairo', name: 'Nasr City', allowsUltraFast: true, etaText: 'Today or tomorrow' },
    { id: 'area_newcairo', zoneId: 'zone_cairo', name: 'New Cairo', allowsUltraFast: true, etaText: 'Today or tomorrow' },
    { id: 'area_giza', zoneId: 'zone_cairo', name: 'Giza', allowsUltraFast: false, etaText: '1–2 working days' },
    { id: 'area_alex', zoneId: 'zone_alex', name: 'Alexandria', allowsUltraFast: false, etaText: '2–3 working days' },
  ];
  for (const a of areas) await prisma.shippingArea.upsert({ where: { id: a.id }, update: {}, create: a });
  // Notification templates (bilingual order-placed)
  for (const locale of ['en', 'ar'] as const) {
    await prisma.notificationTemplate.upsert({
      where: { key_channel_locale: { key: 'order_placed', channel: 'EMAIL', locale } },
      update: {},
      create: {
        key: 'order_placed',
        channel: 'EMAIL',
        locale,
        subject: locale === 'en' ? 'Your Veeey order {{number}}' : 'طلبك من Veeey رقم {{number}}',
        body:
          locale === 'en'
            ? 'Thank you {{name}} — we received order {{number}}.'
            : 'شكرًا {{name}} — استلمنا طلبك رقم {{number}}.',
        variablesJson: ['name', 'number'],
      },
    });
  }
}

// ---- Catalog (created once) -----------------------------------------------
async function seedCatalog() {
  const marker = await prisma.product.findUnique({ where: { sku: 'VEY-SOL-00001' } });
  if (marker) {
    console.log('Catalog already seeded — skipping.');
    return;
  }

  const goals = await prisma.category.upsert({
    where: { slug: 'health-wellness-goals' },
    update: {},
    create: { slug: 'health-wellness-goals', nameEn: 'Health & Wellness Goals', nameAr: 'أهداف الصحة والعافية' },
  });
  const immunity = await prisma.category.upsert({
    where: { slug: 'immunity' },
    update: {},
    create: { slug: 'immunity', nameEn: 'Immunity', nameAr: 'المناعة', parentId: goals.id },
  });
  const energy = await prisma.category.upsert({
    where: { slug: 'energy-vitality' },
    update: {},
    create: { slug: 'energy-vitality', nameEn: 'Energy & Vitality', nameAr: 'الطاقة والحيوية', parentId: goals.id },
  });
  const devices = await prisma.category.upsert({
    where: { slug: 'devices' },
    update: {},
    create: { slug: 'devices', nameEn: 'Health Devices', nameAr: 'الأجهزة الصحية' },
  });

  const solgar = await prisma.brand.upsert({ where: { slug: 'solgar' }, update: {}, create: { slug: 'solgar', nameEn: 'Solgar', nameAr: 'سولجار' } });
  const now = await prisma.brand.upsert({ where: { slug: 'now-foods' }, update: {}, create: { slug: 'now-foods', nameEn: 'NOW Foods', nameAr: 'ناو فودز' } });
  const withings = await prisma.brand.upsert({ where: { slug: 'withings' }, update: {}, create: { slug: 'withings', nameEn: 'Withings', nameAr: 'ويذينجز' } });

  // Attributes + values
  async function attrValue(attrKey: string, attrEn: string, valueEn: string, valueAr: string) {
    const attribute = await prisma.attribute.upsert({
      where: { key: attrKey },
      update: {},
      create: { key: attrKey, nameEn: attrEn },
    });
    return prisma.attributeValue.upsert({
      where: { attributeId_valueEn: { attributeId: attribute.id, valueEn } },
      update: {},
      create: { attributeId: attribute.id, valueEn, valueAr },
    });
  }
  const cap60 = await attrValue('size', 'Size', '60 Capsules', '٦٠ كبسولة');
  const cap120 = await attrValue('size', 'Size', '120 Capsules', '١٢٠ كبسولة');
  const usa = await attrValue('imported-from', 'Imported From', 'USA', 'الولايات المتحدة');
  const uk = await attrValue('imported-from', 'Imported From', 'UK', 'المملكة المتحدة');

  type Seed = {
    sku: string; nameEn: string; nameAr: string; slug: string; kind: 'SUPPLEMENT' | 'DEVICE';
    brandId: string; categoryId: string; priceEgp: number; servings?: number; dailyDosage?: number;
    attrValueIds: string[];
    lots: { expiry: string; qty: number; saleEgp?: number }[];
  };

  const products: Seed[] = [
    {
      sku: 'VEY-SOL-00001', nameEn: 'Vitamin C 1000mg', nameAr: 'فيتامين سي ١٠٠٠ مجم', slug: 'vitamin-c-1000mg',
      kind: 'SUPPLEMENT', brandId: solgar.id, categoryId: immunity.id, priceEgp: 850, servings: 90, dailyDosage: 1,
      attrValueIds: [cap120.id, usa.id],
      lots: [{ expiry: '2027-09-30', qty: 40 }, { expiry: '2026-08-31', qty: 12, saleEgp: 595 }],
    },
    {
      sku: 'VEY-SOL-00002', nameEn: 'Zinc Picolinate 50mg', nameAr: 'زنك بيكولينات ٥٠ مجم', slug: 'zinc-picolinate-50mg',
      kind: 'SUPPLEMENT', brandId: solgar.id, categoryId: immunity.id, priceEgp: 640, servings: 100, dailyDosage: 1,
      attrValueIds: [cap60.id, usa.id],
      lots: [{ expiry: '2028-01-31', qty: 25 }],
    },
    {
      sku: 'VEY-NOW-00001', nameEn: 'CoQ10 100mg', nameAr: 'كو إنزيم كيو١٠ ١٠٠ مجم', slug: 'coq10-100mg',
      kind: 'SUPPLEMENT', brandId: now.id, categoryId: energy.id, priceEgp: 1290, servings: 60, dailyDosage: 1,
      attrValueIds: [cap60.id, usa.id],
      lots: [{ expiry: '2027-05-31', qty: 18 }],
    },
    {
      sku: 'VEY-NOW-00002', nameEn: 'Magnesium Glycinate', nameAr: 'مغنيسيوم جلايسينات', slug: 'magnesium-glycinate',
      kind: 'SUPPLEMENT', brandId: now.id, categoryId: energy.id, priceEgp: 720, servings: 90, dailyDosage: 2,
      attrValueIds: [cap120.id, uk.id],
      lots: [{ expiry: '2026-11-30', qty: 30, saleEgp: 540 }],
    },
    {
      sku: 'VEY-WIT-00001', nameEn: 'Body Smart Scale', nameAr: 'ميزان بودي سمارت', slug: 'body-smart-scale',
      kind: 'DEVICE', brandId: withings.id, categoryId: devices.id, priceEgp: 6900,
      attrValueIds: [uk.id],
      lots: [{ expiry: '2031-12-31', qty: 8 }],
    },
    {
      sku: 'VEY-WIT-00002', nameEn: 'BPM Connect Monitor', nameAr: 'جهاز قياس ضغط BPM Connect', slug: 'bpm-connect-monitor',
      kind: 'DEVICE', brandId: withings.id, categoryId: devices.id, priceEgp: 5400,
      attrValueIds: [usa.id],
      lots: [{ expiry: '2030-06-30', qty: 5 }],
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        sku: p.sku,
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        slugEn: p.slug,
        slugAr: `${p.slug}-ar`,
        kind: p.kind,
        status: 'PUBLISHED',
        basePricePiastres: egp(p.priceEgp),
        servingsPerUnit: p.servings,
        dailyDosage: p.dailyDosage,
        brand: { connect: { id: p.brandId } },
        categories: { connect: [{ id: p.categoryId }] },
        images: { create: [{ url: '/icon.svg', alt: p.nameEn, isPrimary: true }] },
        attributeValues: { create: p.attrValueIds.map((attributeValueId) => ({ attributeValueId })) },
        lots: {
          create: p.lots.map((l) => ({
            locationId: 'loc_main',
            expiryDate: new Date(l.expiry),
            qtyOnHand: l.qty,
            saleFlag: l.saleEgp != null,
            priceOverridePiastres: l.saleEgp != null ? egp(l.saleEgp) : null,
            status: 'LIVE',
          })),
        },
      },
    });
  }
  console.log(`Seeded ${products.length} products with lots.`);
}

async function main() {
  await seedConfig();
  await seedCatalog();
  const [perms, roles, tiers, products, lots] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.tier.count(),
    prisma.product.count(),
    prisma.lot.count(),
  ]);
  console.log(`Seed complete: ${perms} permissions, ${roles} roles, ${tiers} tiers, ${products} products, ${lots} lots.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
