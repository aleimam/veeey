import { describe, it, expect } from 'vitest';
import { TRACKED_MODELS, CREATE_SKIP_MODELS, normalizeValue, diffRecords, snapshotRecord, entityIdOf } from './change-log';

describe('normalizeValue', () => {
  it('passes primitives through and flattens rich types', () => {
    expect(normalizeValue(null)).toBeNull();
    expect(normalizeValue(undefined)).toBeNull();
    expect(normalizeValue(true)).toBe(true);
    expect(normalizeValue(42)).toBe(42);
    expect(normalizeValue(123n)).toBe('123');
    expect(normalizeValue(new Date('2026-07-06T00:00:00Z'))).toBe('2026-07-06T00:00:00.000Z');
    expect(normalizeValue({ a: 1 })).toBe('{"a":1}');
  });

  it('truncates long strings and long JSON', () => {
    const long = 'x'.repeat(1000);
    expect((normalizeValue(long) as string).length).toBe(401); // 400 + ellipsis
    expect((normalizeValue({ big: long }) as string).endsWith('…')).toBe(true);
  });
});

describe('diffRecords', () => {
  it('reports changed fields with normalized from/to', () => {
    const before = { id: 'p1', nameEn: 'Old', basePricePiastres: 1000n, updatedAt: new Date(1) };
    const after = { id: 'p1', nameEn: 'New', basePricePiastres: 2000n, updatedAt: new Date(2) };
    const changes = diffRecords('Product', before, after);
    expect(changes).toEqual([
      { field: 'nameEn', from: 'Old', to: 'New' },
      { field: 'basePricePiastres', from: '1000', to: '2000' },
    ]);
  });

  it('skips global noise fields and ledgered per-model fields', () => {
    const changes = diffRecords(
      'Lot',
      { id: 'l1', qtyOnHand: 5, qtyReserved: 0, condition: 'NEW', updatedAt: new Date(1), syncedAt: null },
      { id: 'l1', qtyOnHand: 3, qtyReserved: 2, condition: 'OPEN_BOX', updatedAt: new Date(2), syncedAt: new Date(2) },
    );
    expect(changes).toEqual([{ field: 'condition', from: 'NEW', to: 'OPEN_BOX' }]);
  });

  it('ignores relation objects added by include on the result', () => {
    const before = { id: 'p1', nameEn: 'Same' };
    const after = { id: 'p1', nameEn: 'Same', brand: { id: 'b1' }, images: [] };
    expect(diffRecords('Product', before, after)).toEqual([]);
  });

  it('handles missing before/after and select-narrowed results', () => {
    expect(diffRecords('Product', null, { id: 'x' })).toEqual([]);
    expect(diffRecords('Product', { id: 'x' }, null)).toEqual([]);
    // result narrowed by select: keys absent from after are not diffed
    expect(diffRecords('Product', { id: 'x', nameEn: 'A' }, { id: 'x' })).toEqual([]);
  });
});

describe('snapshotRecord / entityIdOf / model sets', () => {
  it('snapshots scalars only, skipping noise fields', () => {
    const snap = snapshotRecord('Brand', {
      id: 'b1', nameEn: 'NOW', logo: null, products: [{ id: 'p' }], createdAt: new Date(1), descEn: 'd',
    });
    expect(snap).toEqual({ id: 'b1', nameEn: 'NOW', logo: null, descEn: 'd' });
  });

  it('entityIdOf falls back from id to key (Setting)', () => {
    expect(entityIdOf({ id: 'abc' })).toBe('abc');
    expect(entityIdOf({ key: 'theme.tokens', value: '{}' })).toBe('theme.tokens');
    expect(entityIdOf(null)).toBeNull();
    expect(entityIdOf('nope')).toBeNull();
  });

  it('tracks business entities but not plumbing; create-skip is a subset', () => {
    expect(TRACKED_MODELS.has('Product')).toBe(true);
    expect(TRACKED_MODELS.has('AuditLog')).toBe(false);
    expect(TRACKED_MODELS.has('LotReservation')).toBe(false);
    expect(TRACKED_MODELS.has('AnalyticsEvent')).toBe(false);
    for (const m of CREATE_SKIP_MODELS) expect(TRACKED_MODELS.has(m)).toBe(true);
  });
});
