import { describe, expect, it } from 'vitest';
import { egpToPiastres, piastresToEgp, parseEgpInput } from './format';

describe('money conversion', () => {
  it('egpToPiastres rounds to integer piastres', () => {
    expect(egpToPiastres(9.99)).toBe(999n);
    expect(egpToPiastres(850)).toBe(85000n);
  });
  it('piastresToEgp divides by 100', () => {
    expect(piastresToEgp(960300n)).toBe(9603);
    expect(piastresToEgp(59500n)).toBe(595);
  });
  it('parseEgpInput handles commas and rejects bad input', () => {
    expect(parseEgpInput('1,500.50')).toBe(150050n);
    expect(parseEgpInput('850')).toBe(85000n);
    expect(parseEgpInput('abc')).toBeNull();
    expect(parseEgpInput('-5')).toBeNull();
  });
});
