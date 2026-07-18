import { describe, it, expect } from 'vitest';
import { parseGalleryIds } from './images';

describe('parseGalleryIds', () => {
  it('parses a WooCommerce gallery CSV into positive integer ids', () => {
    expect(parseGalleryIds('12,34,56')).toEqual([12, 34, 56]);
    expect(parseGalleryIds(' 12 , 34 ')).toEqual([12, 34]);
  });
  it('drops empties, zero, and non-numeric junk', () => {
    expect(parseGalleryIds('12,,0,abc,-5,34')).toEqual([12, 34]);
    expect(parseGalleryIds('')).toEqual([]);
    expect(parseGalleryIds(null)).toEqual([]);
    expect(parseGalleryIds(undefined)).toEqual([]);
  });
});
