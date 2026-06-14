import { describe, expect, it } from 'vitest';
import { ingestSchema } from './events';

describe('ingestSchema', () => {
  it('accepts a valid batch', () => {
    const r = ingestSchema.safeParse({
      sessionId: 'sess-abcdef12',
      consent: 'all',
      events: [{ name: 'page_view', path: '/en' }, { name: 'product_view', props: { sku: 'VEY-1' } }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects a too-short session id', () => {
    const r = ingestSchema.safeParse({ sessionId: 'x', events: [{ name: 'page_view' }] });
    expect(r.success).toBe(false);
  });

  it('rejects an empty event list', () => {
    const r = ingestSchema.safeParse({ sessionId: 'sess-abcdef12', events: [] });
    expect(r.success).toBe(false);
  });

  it('allows a null/absent consent (anonymized)', () => {
    const r = ingestSchema.safeParse({ sessionId: 'sess-abcdef12', consent: null, events: [{ name: 'page_view' }] });
    expect(r.success).toBe(true);
  });
});
