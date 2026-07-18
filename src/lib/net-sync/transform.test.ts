import { describe, it, expect } from 'vitest';
import { planProduct, decodeEntities, passesArchiveFloor, type RawProduct, type RawLot } from './transform';

const NOW = new Date('2026-07-19T12:00:00');

const baseLot = (over: Partial<RawLot> = {}): RawLot => ({
  invId: 1, isMain: true, bbe: null, metaStock: null, metaPriceEgp: null, metaRegularEgp: null, metaSaleEgp: null, isExpired: false, ...over,
});

const raw = (over: Partial<RawProduct> = {}): RawProduct => ({
  wpId: 120790, nameEn: 'GHK-Cu Copper Peptide 100 mg', slugEn: 'ghk-cu-copper-peptide', longDescEn: '<p>desc</p>', shortDescEn: 'short',
  nameAr: null, slugAr: null, longDescAr: null, shortDescAr: null, legacySku: '120790',
  priceEgp: 156, regularEgp: 156, saleEgp: null, wcStock: 12, brand: 'Peptidology', categories: [{ nameEn: 'Peptides', slug: 'peptides' }],
  lots: [baseLot({ bbe: new Date('2028-05-31') })], ...over,
});

describe('planProduct (veeey.net catalog transform)', () => {
  it('generates an idempotent VEY sku from brand + wp id and keeps the WC sku as legacy', () => {
    const p = planProduct(raw(), NOW);
    expect(p.sku).toBe('VEY-PEP-120790');
    expect(p.legacySku).toBe('120790');
    expect(planProduct(raw(), NOW).sku).toBe(p.sku); // deterministic
  });

  it('converts EGP major units to piastres (sale price wins over regular)', () => {
    expect(planProduct(raw({ priceEgp: 156, saleEgp: null }), NOW).basePricePiastres).toBe(15600n);
    expect(planProduct(raw({ priceEgp: 156, saleEgp: 120 }), NOW).basePricePiastres).toBe(12000n);
  });

  it('main lot takes stock/price from WC postmeta; expiry from bbe', () => {
    const p = planProduct(raw({ wcStock: 12, priceEgp: 156, lots: [baseLot({ isMain: true, bbe: new Date('2028-05-31') })] }), NOW);
    expect(p.lots).toHaveLength(1);
    expect(p.lots[0].qtyOnHand).toBe(12);
    expect(p.lots[0].status).toBe('LIVE');
    expect(p.lots[0].expiryDate).toEqual(new Date('2028-05-31'));
    // lot price == base → no override recorded
    expect(p.lots[0].priceOverridePiastres).toBeNull();
  });

  it('extra inventory takes stock/price from the ATUM meta table (price-per-expiry override)', () => {
    const p = planProduct(raw({
      priceEgp: 156,
      lots: [
        baseLot({ isMain: true, bbe: new Date('2028-05-31') }),
        baseLot({ invId: 2, isMain: false, bbe: new Date('2027-01-31'), metaStock: 5, metaPriceEgp: 140 }),
      ],
    }), NOW);
    expect(p.lots).toHaveLength(2);
    const extra = p.lots[1];
    expect(extra.qtyOnHand).toBe(5);
    expect(extra.priceOverridePiastres).toBe(14000n); // differs from base 15600 → recorded
  });

  it('classifies a past bbe (or ATUM is_expired) as an EXPIRED lot, kept in the plan', () => {
    expect(planProduct(raw({ lots: [baseLot({ bbe: new Date('2020-01-01') })] }), NOW).lots[0].status).toBe('EXPIRED');
    expect(planProduct(raw({ lots: [baseLot({ bbe: new Date('2028-01-01'), isExpired: true })] }), NOW).lots[0].status).toBe('EXPIRED');
    expect(planProduct(raw({ lots: [baseLot({ bbe: null })] }), NOW).lots[0].status).toBe('LIVE'); // non-perishable
  });

  it('synthesizes a main lot from WC stock when the product has no ATUM inventory', () => {
    const p = planProduct(raw({ wcStock: 7, lots: [] }), NOW);
    expect(p.lots).toHaveLength(1);
    expect(p.lots[0].qtyOnHand).toBe(7);
    expect(p.lots[0].expiryDate).toBeNull();
    expect(p.flags.syntheticLot).toBe(true);
  });

  it('EN-only product leaves nameAr null (storefront falls back to EN)', () => {
    const p = planProduct(raw({ nameAr: null }), NOW);
    expect(p.nameAr).toBeNull();
  });

  it('carries the AR overlay + derives an AR slug when present', () => {
    const p = planProduct(raw({ nameAr: 'ببتيد النحاس', slugAr: 'ghk-cu-ar' }), NOW);
    expect(p.nameAr).toBe('ببتيد النحاس');
    expect(p.slugAr).toBe('ghk-cu-ar');
  });

  it('flags missing price / no live stock for the reconciliation report', () => {
    const p = planProduct(raw({ priceEgp: null, regularEgp: null, saleEgp: null, wcStock: 0, lots: [baseLot({ bbe: null, metaStock: 0 })] }), NOW);
    expect(p.flags.noPrice).toBe(true);
    expect(p.flags.noLiveStock).toBe(true);
    expect(p.basePricePiastres).toBe(0n);
  });

  it('decodes HTML entities in names', () => {
    expect(decodeEntities('Vitamin D3 &amp; K2')).toBe('Vitamin D3 & K2');
    expect(planProduct(raw({ nameEn: 'Omega &amp; Fish' }), NOW).nameEn).toBe('Omega & Fish');
  });
});

describe('passesArchiveFloor (Phase 2 delete-detection safety)', () => {
  it('allows deletions when the scan covered enough of the live set', () => {
    expect(passesArchiveFloor(2703, 3)).toBe(true); // 3 gone of 2703 → fine
    expect(passesArchiveFloor(100, 50, 0.5)).toBe(true); // exactly at floor
  });
  it('BLOCKS mass-archive when the scan is implausibly small (failed source read)', () => {
    expect(passesArchiveFloor(2703, 2000)).toBe(false); // only ~26% seen → bail
    expect(passesArchiveFloor(100, 100)).toBe(false); // scan returned nothing → bail
  });
  it('is a no-op guard on an empty store', () => {
    expect(passesArchiveFloor(0, 0)).toBe(true);
  });
});
