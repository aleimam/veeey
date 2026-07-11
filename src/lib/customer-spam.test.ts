import { describe, expect, it } from 'vitest';
import { findSuspicious, isDisposableEmail, type SpamCandidate } from '@/lib/customer-spam';

const NOW = new Date('2026-07-12T12:00:00Z').getTime();
const base = (over: Partial<SpamCandidate>): SpamCandidate => ({
  id: over.id ?? 'c1',
  email: 'user@gmail.com',
  name: 'Some User',
  firstName: null,
  lastName: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  ordersCount: 1,
  emailVerified: new Date('2026-07-01T00:00:00Z'),
  phoneVerified: null,
  ...over,
});

describe('customer spam heuristics', () => {
  it('detects disposable email domains', () => {
    expect(isDisposableEmail('bot@mailinator.com')).toBe(true);
    expect(isDisposableEmail('user@gmail.com')).toBe(false);
    expect(isDisposableEmail(null)).toBe(false);
    const m = findSuspicious([base({ id: 'a', email: 'x@yopmail.com' })], NOW);
    expect(m.get('a')).toContain('disposable-email');
  });

  it('flags nameless zero-order unverified accounts only', () => {
    const suspicious = base({ id: 'a', name: null, ordersCount: 0, emailVerified: null });
    const named = base({ id: 'b', name: 'Real Person', ordersCount: 0, emailVerified: null, createdAt: new Date('2026-07-10T00:00:00Z') });
    const verified = base({ id: 'c', name: null, ordersCount: 0, createdAt: new Date('2026-07-10T00:00:00Z') });
    const m = findSuspicious([suspicious, named, verified], NOW);
    expect(m.get('a')).toContain('no-name-no-orders');
    expect(m.has('b')).toBe(false);
    expect(m.has('c')).toBe(false);
  });

  it('flags stale unverified zero-order accounts (90d+)', () => {
    const stale = base({ id: 'a', emailVerified: null, ordersCount: 0, createdAt: new Date('2026-01-01T00:00:00Z') });
    const fresh = base({ id: 'b', emailVerified: null, ordersCount: 0, createdAt: new Date('2026-07-01T00:00:00Z') });
    const m = findSuspicious([stale, fresh], NOW);
    expect(m.get('a')).toContain('stale-unverified');
    expect(m.has('b')).toBe(false);
  });

  it('flags signup bursts (10+ in one hour)', () => {
    const burst = Array.from({ length: 10 }, (_, i) =>
      base({ id: `burst-${i}`, createdAt: new Date('2026-07-11T10:15:00Z') }));
    const lone = base({ id: 'lone', createdAt: new Date('2026-07-11T14:00:00Z') });
    const m = findSuspicious([...burst, lone], NOW);
    expect(m.get('burst-0')).toContain('signup-burst');
    expect(m.get('burst-9')).toContain('signup-burst');
    expect(m.has('lone')).toBe(false);
  });

  it('collects multiple reasons without duplicates', () => {
    const c = base({ id: 'a', email: 'x@tempmail.com', name: null, ordersCount: 0, emailVerified: null, createdAt: new Date('2026-01-01T00:00:00Z') });
    const m = findSuspicious([c], NOW);
    const reasons = m.get('a')!;
    expect(reasons).toEqual(expect.arrayContaining(['disposable-email', 'no-name-no-orders', 'stale-unverified']));
    expect(new Set(reasons).size).toBe(reasons.length);
  });
});
