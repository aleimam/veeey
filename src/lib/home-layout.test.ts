import { describe, it, expect } from 'vitest';
import {
  defaultLayout, normalizeLayout, moveBlock, toggleBlock, removeBlock, addGadget,
  parseLayout, BUILTIN_TYPES, type Block,
} from './home-layout';

describe('home-layout', () => {
  it('default layout has every built-in, enabled, in order', () => {
    const l = defaultLayout();
    expect(l.map((b) => b.type)).toEqual([...BUILTIN_TYPES]);
    expect(l.every((b) => b.enabled)).toBe(true);
  });

  it('normalize appends a missing built-in (disabled) and drops unknown types', () => {
    const stored: Block[] = [{ id: 'hero', type: 'hero', enabled: false }, { id: 'x', type: 'bogus' as 'hero', enabled: true }];
    const n = normalizeLayout(stored);
    expect(n.find((b) => b.type === 'hero')?.enabled).toBe(false);
    expect(n.find((b) => b.type === 'brands')).toBeTruthy(); // appended
    expect(n.find((b) => (b.type as string) === 'bogus')).toBeUndefined();
  });

  it('normalize dedupes singleton built-ins', () => {
    const stored: Block[] = [{ id: 'hero', type: 'hero', enabled: true }, { id: 'hero', type: 'hero', enabled: false }];
    expect(normalizeLayout(stored).filter((b) => b.type === 'hero')).toHaveLength(1);
  });

  it('move respects bounds', () => {
    const l = defaultLayout();
    expect(moveBlock(l, 'hero', -1)).toEqual(l); // already first
    const moved = moveBlock(l, 'hero', 1);
    expect(moved[0].type).toBe('greet-strip');
    expect(moved[1].type).toBe('hero');
  });

  it('toggle flips enabled', () => {
    const l = defaultLayout();
    expect(toggleBlock(l, 'hero').find((b) => b.id === 'hero')?.enabled).toBe(false);
  });

  it('add gadget then remove it; built-ins are not removable', () => {
    let l = defaultLayout();
    l = addGadget(l, 'rich', 'g-1');
    expect(l.at(-1)).toMatchObject({ id: 'g-1', type: 'rich', enabled: true });
    l = removeBlock(l, 'g-1');
    expect(l.find((b) => b.id === 'g-1')).toBeUndefined();
    const before = l.length;
    l = removeBlock(l, 'hero'); // built-in: no-op
    expect(l.length).toBe(before);
  });

  it('parseLayout validates and normalizes', () => {
    const l = parseLayout([{ id: 'g-1', type: 'cta', enabled: true, props: { headingEn: 'Hi' } }]);
    expect(l.find((b) => b.id === 'g-1')?.type).toBe('cta');
    expect(l.filter((b) => b.type === 'hero')).toHaveLength(1); // built-ins appended
  });
});
