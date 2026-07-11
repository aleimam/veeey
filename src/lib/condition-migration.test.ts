import { describe, it, expect } from 'vitest';
import { parseConditionMarker, nameKey } from './condition-migration';

describe('parseConditionMarker', () => {
  it('parses the real-world markers', () => {
    expect(parseConditionMarker('NOW Omega-3 1000mg {Broken bottle}')).toEqual({ baseName: 'NOW Omega-3 1000mg', condition: 'BROKEN' });
    expect(parseConditionMarker('CoQ10 {Damaged Bottle}')).toEqual({ baseName: 'CoQ10', condition: 'DAMAGED' });
    expect(parseConditionMarker('Scale {open box}')).toEqual({ baseName: 'Scale', condition: 'OPEN_BOX' });
  });

  it('marker position/casing/extra spaces are tolerated', () => {
    expect(parseConditionMarker('{BROKEN} Vitamin D3')).toEqual({ baseName: 'Vitamin D3', condition: 'BROKEN' });
    expect(parseConditionMarker('A   {damaged}   B')).toEqual({ baseName: 'A B', condition: 'DAMAGED' });
  });

  it('returns null for no marker, non-condition markers, or empty base', () => {
    expect(parseConditionMarker('Plain product')).toBeNull();
    expect(parseConditionMarker('Special {limited edition}')).toBeNull();
    expect(parseConditionMarker('{Broken bottle}')).toBeNull(); // nothing left as a base name
  });
});

describe('nameKey', () => {
  it('normalizes case + whitespace for matching', () => {
    expect(nameKey('  NOW  Omega-3 ')).toBe(nameKey('now omega-3'));
    expect(nameKey('A B')).not.toBe(nameKey('AB'));
  });
});
