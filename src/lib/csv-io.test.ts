import { describe, it, expect } from 'vitest';
import { buildCsv, parseCsv, parseCsvObjects, csvCell } from './csv-io';

describe('csv-io', () => {
  it('quotes cells with commas, quotes, newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });

  it('builds a CSV with header + rows', () => {
    expect(buildCsv(['a', 'b'], [[1, 'x,y'], [2, 'z']])).toBe('a,b\r\n1,"x,y"\r\n2,z');
  });

  it('round-trips through parse', () => {
    const csv = buildCsv(['name', 'note'], [['Sara', 'a,b'], ['Ali', 'multi\nline']]);
    const rows = parseCsv(csv);
    expect(rows).toEqual([['name', 'note'], ['Sara', 'a,b'], ['Ali', 'multi\nline']]);
  });

  it('parses into header-keyed objects and trims', () => {
    const objs = parseCsvObjects('sku, name\r\nVY-1, Vitamin C\r\nVY-2, Zinc');
    expect(objs).toEqual([
      { sku: 'VY-1', name: 'Vitamin C' },
      { sku: 'VY-2', name: 'Zinc' },
    ]);
  });

  it('ignores a UTF-8 BOM and trailing blank lines', () => {
    expect(parseCsvObjects('﻿a,b\r\n1,2\r\n')).toEqual([{ a: '1', b: '2' }]);
  });
});
