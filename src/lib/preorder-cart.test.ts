import { describe, it, expect } from 'vitest';
import {
  parsePreorderCart, serializePreorderCart, addPreorderLine, setPreorderQty,
  removePreorderLine, preorderCount,
} from './preorder-cart';

describe('parsePreorderCart', () => {
  it('parses a valid list and clamps quantities', () => {
    expect(parsePreorderCart('[{"productId":"p1","qty":2},{"productId":"p2","qty":150}]')).toEqual([
      { productId: 'p1', qty: 2 },
      { productId: 'p2', qty: 99 },
    ]);
  });

  it('coalesces duplicate product ids and floors qty at 1', () => {
    expect(parsePreorderCart('[{"productId":"p1","qty":2},{"productId":"p1","qty":3},{"productId":"p1"}]')).toEqual([
      { productId: 'p1', qty: 6 },
    ]);
  });

  it('tolerates garbage / non-arrays / missing ids', () => {
    expect(parsePreorderCart('not json')).toEqual([]);
    expect(parsePreorderCart('{"productId":"p1"}')).toEqual([]);
    expect(parsePreorderCart('[{"qty":3},{"productId":5}]')).toEqual([]);
    expect(parsePreorderCart(null)).toEqual([]);
    expect(parsePreorderCart(undefined)).toEqual([]);
  });

  it('round-trips through serialize', () => {
    const lines = [{ productId: 'a', qty: 1 }, { productId: 'b', qty: 4 }];
    expect(parsePreorderCart(serializePreorderCart(lines))).toEqual(lines);
  });
});

describe('mutations', () => {
  it('addPreorderLine adds new and increments existing (capped at 99)', () => {
    let lines = addPreorderLine([], 'p1', 2);
    expect(lines).toEqual([{ productId: 'p1', qty: 2 }]);
    lines = addPreorderLine(lines, 'p1', 3);
    expect(lines).toEqual([{ productId: 'p1', qty: 5 }]);
    lines = addPreorderLine(lines, 'p1', 200);
    expect(lines).toEqual([{ productId: 'p1', qty: 99 }]);
    expect(addPreorderLine(lines, '', 1)).toBe(lines); // no-op on empty id
  });

  it('setPreorderQty sets exact qty and removes at 0', () => {
    const lines = [{ productId: 'p1', qty: 5 }, { productId: 'p2', qty: 2 }];
    expect(setPreorderQty(lines, 'p1', 3)).toEqual([{ productId: 'p1', qty: 3 }, { productId: 'p2', qty: 2 }]);
    expect(setPreorderQty(lines, 'p1', 0)).toEqual([{ productId: 'p2', qty: 2 }]);
  });

  it('removePreorderLine drops the line; preorderCount sums qty', () => {
    const lines = [{ productId: 'p1', qty: 5 }, { productId: 'p2', qty: 2 }];
    expect(removePreorderLine(lines, 'p1')).toEqual([{ productId: 'p2', qty: 2 }]);
    expect(preorderCount(lines)).toBe(7);
  });
});
