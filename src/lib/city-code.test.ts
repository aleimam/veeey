import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cityCode } from './city-code';
import { GOVERNORATES } from './governorates';

type Seed = { code: string; governorate: string; nameEn: string; nameAr: string };
const seed: Seed[] = JSON.parse(readFileSync('prisma/data/egypt-cities.json', 'utf8'));

describe('cityCode', () => {
  it('is a stable ascii key derived from governorate + name', () => {
    expect(cityCode('Cairo', 'Nasr City')).toBe('cairo:nasr-city');
    expect(cityCode('Kafr El Sheikh', 'Desouk')).toBe('kafr-el-sheikh:desouk');
  });

  it('collapses punctuation and case so "6th of October" survives a re-typing', () => {
    expect(cityCode('Giza', 'Sixth of October')).toBe('giza:sixth-of-october');
    expect(cityCode('Cairo', '15 May')).toBe('cairo:15-may');
    expect(cityCode('Cairo', '  El-Khalifa  ')).toBe('cairo:el-khalifa');
  });
});

describe('the seeded district list', () => {
  it('covers every governorate the address form offers', () => {
    // A governorate with no districts leaves its customers with an empty
    // dropdown and no way to finish checkout — the one gap that must not exist.
    const covered = new Set(seed.map((s) => s.governorate));
    for (const g of GOVERNORATES) expect(covered.has(g.en), `no districts for ${g.en}`).toBe(true);
  });

  it('uses ONLY canonical governorate names', () => {
    // The source dataset spells five of them differently (Gharbiya, Menofia,
    // Qaliubiya, Sharkia, Kafr Al sheikh). If a remap is ever dropped, the
    // dropdown silently shows nothing for that governorate.
    const names = new Set(GOVERNORATES.map((g) => g.en));
    for (const s of seed) expect(names.has(s.governorate), `unmapped: ${s.governorate}`).toBe(true);
  });

  it('has no duplicate codes, and every code matches its own name', () => {
    const codes = seed.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const s of seed) expect(s.code).toBe(cityCode(s.governorate, s.nameEn));
  });

  it('carries an Arabic name for every district', () => {
    for (const s of seed) expect(s.nameAr.trim(), s.code).not.toBe('');
  });

  it('includes the districts customers actually type', () => {
    // Straight from the top of the live free-text data — if the list omitted
    // these, the dropdown would be worse than the text box it replaces.
    const en = new Set(seed.map((s) => s.nameEn));
    for (const d of ['Nasr City', 'Maadi', 'New Cairo', 'Sheraton', 'Rehab', 'Shorouk', 'Sixth of October', 'Cheikh Zayed']) {
      expect(en.has(d), `missing district: ${d}`).toBe(true);
    }
  });
});
