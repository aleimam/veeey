import { describe, expect, it } from 'vitest';
import { resolveAwb } from './awb';

const addr = { name: 'Mona', phone: '01000000000', governorate: 'Cairo', city: 'Nasr City', area: 'Zone 7', street: '10 Abbas St' };

describe('resolveAwb (courier waybill field resolution)', () => {
  it('uses the stored address + defaults when there are no staff edits', () => {
    const r = resolveAwb(addr, undefined, 250);
    expect(r).toMatchObject({ name: 'Mona', phone: '01000000000', city: 'Nasr City', gov: 'Cairo', pieces: 1, weightKg: 1, contents: 'Health products', cod: 250 });
    expect(r.street).toBe('10 Abbas St, Zone 7'); // street + area combined
  });

  it('lets staff edits win over the stored address', () => {
    const r = resolveAwb(addr, { name: 'Mona Ali', city: 'Giza', pieces: 3, weightKg: 2.5, contents: 'Supplements', codAmount: 0 }, 250);
    expect(r).toMatchObject({ name: 'Mona Ali', city: 'Giza', pieces: 3, weightKg: 2.5, contents: 'Supplements', cod: 0 });
    expect(r.phone).toBe('01000000000'); // untouched field falls back to the order
  });

  it('overrides COD to 0 explicitly (not the auto amount) when staff clear it', () => {
    expect(resolveAwb(addr, { codAmount: 0 }, 250).cod).toBe(0);
    expect(resolveAwb(addr, {}, 250).cod).toBe(250); // no override → auto
  });

  it('falls back to safe defaults for a bare address', () => {
    const r = resolveAwb({}, undefined, 0);
    expect(r).toMatchObject({ name: 'Customer', phone: '', city: '', gov: '', street: '-', pieces: 1, weightKg: 1, cod: 0 });
  });

  it('ignores non-positive pieces/weight and rounds pieces', () => {
    const r = resolveAwb(addr, { pieces: 2.7, weightKg: -1 }, 0);
    expect(r.pieces).toBe(3); // rounded
    expect(r.weightKg).toBe(1); // -1 rejected → default
  });
});
