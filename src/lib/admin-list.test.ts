import { describe, it, expect } from 'vitest';
import { parseListParams, listQs, totalPages, pageRange, one, clientPage } from './admin-list';

describe('parseListParams', () => {
  const opts = { sortable: ['name', 'price', 'createdAt'], defaultSort: 'createdAt' } as const;
  it('uses defaults when params are absent', () => {
    expect(parseListParams({}, opts)).toMatchObject({ sort: 'createdAt', dir: 'desc', page: 1, perPage: 50, skip: 0, take: 50 });
  });
  it('honours a valid sort + dir + page', () => {
    const r = parseListParams({ sort: 'price', dir: 'asc', page: '3' }, opts);
    expect(r).toMatchObject({ sort: 'price', dir: 'asc', page: 3, skip: 100 });
  });
  it('ignores a sort column not in the allow-list', () => {
    expect(parseListParams({ sort: 'id; DROP TABLE' }, opts).sort).toBe('createdAt');
  });
  it('clamps page and perPage', () => {
    expect(parseListParams({ page: '0' }, opts).page).toBe(1);
    expect(parseListParams({ page: '-5' }, opts).page).toBe(1);
    expect(parseListParams({ per: '5' }, opts).perPage).toBe(10);
    expect(parseListParams({ per: '9999' }, opts).perPage).toBe(200);
  });
});

describe('listQs', () => {
  it('keeps existing params and applies overrides', () => {
    expect(listQs({ q: 'vit', status: 'PUBLISHED' }, { page: 2 })).toBe('?q=vit&status=PUBLISHED&page=2');
  });
  it('drops params overridden to empty/undefined (e.g. reset page on re-sort)', () => {
    expect(listQs({ q: 'vit', page: '4' }, { sort: 'name', dir: 'asc', page: undefined })).toBe('?q=vit&sort=name&dir=asc');
  });
  it('returns empty string when no params', () => {
    expect(listQs({}, {})).toBe('');
  });
});

describe('totalPages / pageRange', () => {
  it('computes total pages', () => {
    expect(totalPages(2739, 50)).toBe(55);
    expect(totalPages(0, 50)).toBe(1);
    expect(totalPages(50, 50)).toBe(1);
  });
  it('computes the visible row range', () => {
    expect(pageRange(1, 50, 2739)).toEqual({ from: 1, to: 50 });
    expect(pageRange(55, 50, 2739)).toEqual({ from: 2701, to: 2739 });
    expect(pageRange(1, 50, 0)).toEqual({ from: 0, to: 0 });
  });
});

describe('clientPage', () => {
  const data = [{ n: 'Cee', v: 3 }, { n: 'Aay', v: 1 }, { n: 'Bee', v: 2 }];
  const keys = { name: (r: { n: string }) => r.n, val: (r: { v: number }) => r.v };
  it('sorts by a string key asc/desc and reports total', () => {
    const asc = clientPage(data, { sort: 'name', dir: 'asc', page: 1, perPage: 10 }, keys);
    expect(asc.rows.map((r) => r.n)).toEqual(['Aay', 'Bee', 'Cee']);
    expect(asc.total).toBe(3);
    expect(clientPage(data, { sort: 'name', dir: 'desc', page: 1, perPage: 10 }, keys).rows.map((r) => r.n)).toEqual(['Cee', 'Bee', 'Aay']);
  });
  it('sorts numerically and slices to the page', () => {
    const p2 = clientPage(data, { sort: 'val', dir: 'asc', page: 2, perPage: 2 }, keys);
    expect(p2.rows.map((r) => r.v)).toEqual([3]);
    expect(p2.total).toBe(3);
  });
  it('leaves order untouched for an unknown sort column', () => {
    expect(clientPage(data, { sort: 'nope', dir: 'asc', page: 1, perPage: 10 }, keys).rows).toEqual(data);
  });
});

describe('one', () => {
  it('takes the first of an array and treats empty as undefined', () => {
    expect(one(['a', 'b'])).toBe('a');
    expect(one('x')).toBe('x');
    expect(one('')).toBeUndefined();
    expect(one(undefined)).toBeUndefined();
  });
});
