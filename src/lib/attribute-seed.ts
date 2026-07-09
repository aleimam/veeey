import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/sku';
import type { ProductKind } from '@/generated/prisma/client';

/**
 * Standard catalog attribute sets (V3-ATTR-4), from V3 admin.docx. Idempotent:
 * attributes are created-if-missing by `key` (existing ones are never clobbered
 * so owner edits survive re-runs); values are created-if-missing by valueEn with
 * an auto slug + append order. English values only — Arabic is left blank to be
 * translated later. `unit` marks measured attributes; `filterable` marks natural
 * storefront facets.
 *
 * Notes on the doc's "shared" guidance: Brand is a first-class entity here, so
 * no Brand attribute is seeded. Country of Origin + Certifications are shared
 * records (multi-kind); Form and Included Accessories differ meaningfully
 * between supplements and injections, so those are separate records.
 */
type Seed = {
  key: string; nameEn: string; kinds: ProductKind[];
  inputType?: 'SINGLE_SELECT' | 'MULTI_SELECT'; unit?: boolean; filterable?: boolean;
  values: string[];
};

const M = 'MULTI_SELECT' as const;

export const ATTRIBUTE_SEED: Seed[] = [
  // ---- DEVICE ----
  { key: 'device-category', nameEn: 'Device Category', kinds: ['DEVICE'], filterable: true, values: ['Monitoring', 'Therapeutic', 'Diagnostic', 'Beauty'] },
  { key: 'primary-use', nameEn: 'Primary Use / Application', kinds: ['DEVICE'], filterable: true, values: ['Blood Pressure Monitoring', 'Skin Rejuvenation', 'Pain Management'] },
  { key: 'technology', nameEn: 'Technology', kinds: ['DEVICE'], filterable: true, values: ['LED Therapy', 'Microcurrent', 'Laser', 'Ultrasound'] },
  { key: 'target-body-area', nameEn: 'Target Body Area', kinds: ['DEVICE'], filterable: true, values: ['Face', 'Body', 'Joints', 'Specific Area'] },
  { key: 'key-features', nameEn: 'Key Features', kinds: ['DEVICE'], inputType: M, filterable: true, values: ['FDA Cleared', 'Clinically Proven', 'Portable', 'Rechargeable', 'App-Controlled'] },
  { key: 'power-source', nameEn: 'Power Source', kinds: ['DEVICE'], values: ['Rechargeable Battery', 'Mains Power'] },
  { key: 'connectivity', nameEn: 'Connectivity', kinds: ['DEVICE'], values: ['Bluetooth', 'Wi-Fi', 'None'] },
  { key: 'included-accessories', nameEn: 'Included Accessories', kinds: ['DEVICE'], inputType: M, values: ['Charger', 'Applicator Heads', 'Gel', 'Case'] },
  { key: 'regulatory-status', nameEn: 'Regulatory Status', kinds: ['DEVICE'], values: ['FDA Cleared', 'CE Marked'] },

  // ---- SUPPLEMENT ----
  { key: 'primary-health-goal', nameEn: 'Primary Health Goal', kinds: ['SUPPLEMENT'], inputType: M, filterable: true, values: ['Immune Support', 'Energy', 'Brain Health'] },
  { key: 'key-ingredient', nameEn: 'Key Ingredient(s)', kinds: ['SUPPLEMENT'], inputType: M, filterable: true, values: ['Vitamin C', 'Omega-3', 'Turmeric', 'Collagen'] },
  { key: 'dosage-strength', nameEn: 'Dosage / Strength per Serving', kinds: ['SUPPLEMENT'], unit: true, values: ['1000 mg', '5000 IU', '50 Billion CFU'] },
  { key: 'form', nameEn: 'Form', kinds: ['SUPPLEMENT'], filterable: true, values: ['Capsule', 'Tablet', 'Softgel', 'Gummy', 'Powder', 'Liquid'] },
  { key: 'package-quantity', nameEn: 'Package Quantity', kinds: ['SUPPLEMENT'], unit: true, values: ['60', '120', '250 ml', '500 g'] },
  { key: 'serving-size', nameEn: 'Serving Size', kinds: ['SUPPLEMENT'], values: ['1 Capsule', '2 Gummies', '1 Scoop (10g)'] },
  { key: 'servings-per-container', nameEn: 'Servings Per Container', kinds: ['SUPPLEMENT'], values: ['30', '60', '90', '120'] },
  { key: 'target-user', nameEn: 'Target User', kinds: ['SUPPLEMENT'], filterable: true, values: ['Adults', 'Men', 'Women', 'Men 50+', 'Women 50+', 'Children'] },
  { key: 'dietary-features', nameEn: 'Dietary Features', kinds: ['SUPPLEMENT'], inputType: M, filterable: true, values: ['Organic', 'Non-GMO', 'Vegan', 'Gluten-Free', 'Halal'] },

  // ---- INJECTION (peptides) ----
  { key: 'peptide-category', nameEn: 'Peptide Category', kinds: ['INJECTION'], filterable: true, values: ['Healing & Recovery', 'Growth Hormone Secretagogue', 'Metabolic/Weight', 'Anti-Aging', 'Cognitive'] },
  { key: 'key-peptide', nameEn: 'Key Peptide / Compound', kinds: ['INJECTION'], inputType: M, filterable: true, values: ['BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295', 'Semaglutide', 'GHK-Cu'] },
  { key: 'primary-goal', nameEn: 'Primary Goal', kinds: ['INJECTION'], inputType: M, filterable: true, values: ['Injury Recovery', 'Muscle Growth', 'Fat Loss', 'Skin/Anti-Aging', 'Sleep & Recovery'] },
  { key: 'form-injection', nameEn: 'Form', kinds: ['INJECTION'], filterable: true, values: ['Lyophilized Powder (Vial)', 'Pre-mixed Pen', 'Nasal Spray'] },
  { key: 'strength-per-vial', nameEn: 'Strength per Vial', kinds: ['INJECTION'], unit: true, values: ['5 mg', '10 mg', '15 mg'] },
  { key: 'vial-size', nameEn: 'Vial Size', kinds: ['INJECTION'], unit: true, values: ['2 ml', '3 ml', '5 ml'] },
  { key: 'reconstitution-required', nameEn: 'Reconstitution Required', kinds: ['INJECTION'], values: ['Yes', 'No'] },
  { key: 'storage-requirements', nameEn: 'Storage Requirements', kinds: ['INJECTION'], values: ['Refrigerated (2–8°C)', 'Room Temperature'] },
  { key: 'included-accessories-injection', nameEn: 'Included Accessories', kinds: ['INJECTION'], inputType: M, values: ['Bacteriostatic Water', 'Syringes', 'Alcohol Swabs', 'Storage Case'] },

  // ---- SHARED (multi-kind) ----
  { key: 'country-of-origin', nameEn: 'Country of Origin', kinds: ['SUPPLEMENT', 'INJECTION', 'DEVICE'], filterable: true, values: ['USA', 'UK', 'Germany', 'New Zealand'] },
  { key: 'certifications-compliance', nameEn: 'Certifications / Compliance', kinds: ['SUPPLEMENT', 'INJECTION'], inputType: M, filterable: true, values: ['GMP Certified', 'Third-Party Tested', 'COA Available'] },
];

export type AttributeSeedReport = { attributesCreated: number; attributesExisting: number; valuesCreated: number };

export async function seedStandardAttributes(): Promise<AttributeSeedReport> {
  const report: AttributeSeedReport = { attributesCreated: 0, attributesExisting: 0, valuesCreated: 0 };
  for (const s of ATTRIBUTE_SEED) {
    const existing = await prisma.attribute.findUnique({ where: { key: s.key }, select: { id: true } });
    let attributeId: string;
    if (existing) {
      attributeId = existing.id;
      report.attributesExisting++;
    } else {
      const created = await prisma.attribute.create({
        data: {
          key: s.key, nameEn: s.nameEn,
          kind: s.kinds[0], kinds: s.kinds,
          inputType: s.inputType ?? 'SINGLE_SELECT',
          unit: s.unit ? '' : null,
          isFilterable: !!s.filterable,
        },
        select: { id: true },
      });
      attributeId = created.id;
      report.attributesCreated++;
    }
    // Values: create-if-missing by valueEn (unique per attribute), auto slug + order.
    const have = new Set((await prisma.attributeValue.findMany({ where: { attributeId }, select: { valueEn: true } })).map((v) => v.valueEn));
    let order = (await prisma.attributeValue.aggregate({ where: { attributeId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1;
    for (const val of s.values) {
      if (have.has(val)) continue;
      order++;
      await prisma.attributeValue.create({ data: { attributeId, valueEn: val, slug: slugify(val) || null, sortOrder: order } });
      report.valuesCreated++;
    }
  }
  return report;
}
