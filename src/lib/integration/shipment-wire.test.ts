import { describe, expect, it } from 'vitest';
import { parseShipmentReceived, parseShipmentReview, totalUnits } from './shipment-wire';

// Byte-shape of what YeldnIN's buildShipmentWire actually emits.
const EV = {
  shipmentUid: 'SHP2607001',
  shipmentId: 7,
  receivedAt: '2026-07-21T12:00:00.000Z',
  lines: [
    {
      sku: 'VEY-CEN-00914',
      veeeyWpId: 914,
      productName: 'Centrum',
      lots: [
        { expiryDate: '2027-03-31', lotCode: 'L1', quantity: 3, unitCost: 10, currency: null },
        { expiryDate: '2028-01-31', lotCode: null, quantity: 2, unitCost: 4.5, currency: 'USD' },
      ],
    },
  ],
  photoAssetIds: ['a1', 'a2'],
};

describe('parseShipmentReceived (re-baselined against YeldnIN, not the contract snapshot)', () => {
  it('accepts the real wire and preserves lots, cost and currency', () => {
    const w = parseShipmentReceived(EV)!;
    expect(w.shipmentUid).toBe('SHP2607001');
    expect(w.lines).toHaveLength(1);
    expect(w.lines[0].lots).toEqual([
      { expiryDate: '2027-03-31', lotCode: 'L1', quantity: 3, unitCost: 10, currency: null },
      { expiryDate: '2028-01-31', lotCode: null, quantity: 2, unitCost: 4.5, currency: 'USD' },
    ]);
    expect(w.photoAssetIds).toEqual(['a1', 'a2']);
    expect(totalUnits(w)).toBe(5);
  });

  it('requires the shipment uid — it is the idempotency key', () => {
    expect(parseShipmentReceived({ ...EV, shipmentUid: '' })).toBeNull();
    expect(parseShipmentReceived({ ...EV, shipmentUid: undefined })).toBeNull();
  });

  it('rejects an empty shipment rather than storing a fact that says nothing arrived', () => {
    expect(parseShipmentReceived({ ...EV, lines: [] })).toBeNull();
    expect(parseShipmentReceived({ ...EV, lines: [{ ...EV.lines[0], lots: [] }] })).toBeNull();
    expect(parseShipmentReceived(null)).toBeNull();
  });

  it('drops zero/negative-quantity lots (a zero row would read as "we got none")', () => {
    const w = parseShipmentReceived({
      ...EV,
      lines: [{ ...EV.lines[0], lots: [{ expiryDate: '2027-03-31', lotCode: null, quantity: 0, unitCost: 1, currency: null }, EV.lines[0].lots[0]] }],
    })!;
    expect(w.lines[0].lots).toHaveLength(1);
    expect(w.lines[0].lots[0].quantity).toBe(3);
  });

  it('a null expiry is a real lot (devices), not a reason to drop the line', () => {
    const w = parseShipmentReceived({
      ...EV,
      lines: [{ sku: 'VEY-DEV-1', veeeyWpId: null, productName: 'BP Monitor', lots: [{ expiryDate: null, lotCode: null, quantity: 4, unitCost: null, currency: null }] }],
    })!;
    expect(w.lines[0].lots[0]).toMatchObject({ expiryDate: null, quantity: 4, unitCost: null });
  });

  it('a line with no product name is unusable and is dropped', () => {
    expect(parseShipmentReceived({ ...EV, lines: [{ ...EV.lines[0], productName: '  ' }] })).toBeNull();
  });

  it('falls back to now when receivedAt is missing or unparseable', () => {
    const w = parseShipmentReceived({ ...EV, receivedAt: 'not-a-date' })!;
    expect(Number.isNaN(Date.parse(w.receivedAt))).toBe(false);
  });

  it('normalises currency case', () => {
    const w = parseShipmentReceived({ ...EV, lines: [{ ...EV.lines[0], lots: [{ ...EV.lines[0].lots[1], currency: 'gbp' }] }] })!;
    expect(w.lines[0].lots[0].currency).toBe('GBP');
  });
});

describe('parseShipmentReview — the verdict, travelling either way', () => {
  const ok = { shipmentUid: ' SHP-9 ', decision: 'approved', reason: '  ', reviewedAt: '2026-07-22T10:00:00.000Z' };

  it('normalises the uid and upper-cases the decision', () => {
    expect(parseShipmentReview(ok)).toEqual({ shipmentUid: 'SHP-9', decision: 'APPROVED', reason: null, reviewedAt: '2026-07-22T10:00:00.000Z' });
  });

  it('keeps a real reason, trimmed and capped', () => {
    const r = parseShipmentReview({ ...ok, decision: 'REJECTED', reason: ` ${'x'.repeat(600)} ` })!;
    expect(r.decision).toBe('REJECTED');
    expect(r.reason).toHaveLength(500);
  });

  it('REJECTS an unknown decision rather than defaulting to one', () => {
    // Defaulting to APPROVED would put unreviewed goods on sale; defaulting to
    // REJECTED would bounce a shipment nobody rejected. Neither is acceptable.
    expect(parseShipmentReview({ ...ok, decision: 'MAYBE' })).toBeNull();
    expect(parseShipmentReview({ ...ok, decision: '' })).toBeNull();
    expect(parseShipmentReview({ ...ok, decision: 42 })).toBeNull();
  });

  it('requires a shipment uid — it is the only thing that identifies the goods', () => {
    expect(parseShipmentReview({ ...ok, shipmentUid: '   ' })).toBeNull();
    expect(parseShipmentReview({ ...ok, shipmentUid: undefined })).toBeNull();
    expect(parseShipmentReview(null)).toBeNull();
  });

  it('falls back to now for a missing or unparseable timestamp', () => {
    expect(parseShipmentReview({ ...ok, reviewedAt: 'whenever' })!.reviewedAt).not.toBe('whenever');
    expect(Date.parse(parseShipmentReview({ ...ok, reviewedAt: undefined })!.reviewedAt)).not.toBeNaN();
  });
});
