import { describe, expect, it } from 'vitest';
import {
  findSuspicious, isDisposableEmail, isSpamEmailDomain, hasLinkInName, hasCyrillicName,
  isPurgeable, type SpamCandidate,
} from '@/lib/customer-spam';

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

// The signup flood the owner reported on 2026-07-22: CIS mailboxes, links
// smuggled into the name field, Cyrillic names.
describe('junk-signup signals', () => {
  it('recognises CIS mailbox providers and throwaway TLDs', () => {
    expect(isSpamEmailDomain('bot@mail.ru')).toBe(true);
    expect(isSpamEmailDomain('BOT@Yandex.RU')).toBe(true);
    expect(isSpamEmailDomain('x@promo.xyz')).toBe(true);
    expect(isSpamEmailDomain('x@shop.top')).toBe(true);
    expect(isSpamEmailDomain('real@gmail.com')).toBe(false);
    expect(isSpamEmailDomain('real@egyptvitamins.com')).toBe(false);
    expect(isSpamEmailDomain(null)).toBe(false);
  });

  it('spots links and domains hidden in a name', () => {
    expect(hasLinkInName('Buy cheap pills bestpills.top')).toBe(true);
    expect(hasLinkInName('http://spam.example')).toBe(true);
    expect(hasLinkInName('www.spam.ru')).toBe(true);
    expect(hasLinkInName('[url=http://x]click[/url]')).toBe(true);
    expect(hasLinkInName('Mohamed Abutaleb')).toBe(false);
    expect(hasLinkInName('Dr. Ali')).toBe(false); // a dot is not a domain
    expect(hasLinkInName(null, undefined)).toBe(false);
  });

  it('does not read an email used as a display name as a smuggled link', () => {
    // Imports and OTP signups fall back to the email address for the name.
    const c = base({ id: 'a', email: 'ali@gmail.com', name: 'ali@gmail.com' });
    expect(findSuspicious([c], NOW).has('a')).toBe(false);
  });

  it('spots Cyrillic names — the store serves Arabic and English only', () => {
    expect(hasCyrillicName('Иван Петров')).toBe(true);
    expect(hasCyrillicName('محمد أبو طالب')).toBe(false);
    expect(hasCyrillicName('Mohamed')).toBe(false);
  });

  it('reports each signal as its own reason', () => {
    const m = findSuspicious([
      base({ id: 'ru', email: 'x@mail.ru' }),
      base({ id: 'link', name: 'cheap pills bestpills.top' }),
      base({ id: 'cyr', firstName: 'Иван' }),
    ], NOW);
    expect(m.get('ru')).toContain('spam-email-domain');
    expect(m.get('link')).toContain('link-in-name');
    expect(m.get('cyr')).toContain('cyrillic-name');
  });
});

describe('isPurgeable — what may be deleted without a human', () => {
  const junk = base({ id: 'a', email: 'x@mail.ru', ordersCount: 0, emailVerified: null, phoneVerified: null });

  it('deletes only on a strong signal with nothing to lose', () => {
    expect(isPurgeable(junk, ['spam-email-domain'])).toBe(true);
  });

  it('never deletes an account that has ordered', () => {
    expect(isPurgeable({ ...junk, ordersCount: 1 }, ['spam-email-domain'])).toBe(false);
  });

  it('never deletes an account with a verified contact', () => {
    expect(isPurgeable({ ...junk, emailVerified: new Date() }, ['spam-email-domain'])).toBe(false);
    expect(isPurgeable({ ...junk, phoneVerified: new Date() }, ['spam-email-domain'])).toBe(false);
  });

  it('never deletes on weak signals alone — quiet real customers look like these', () => {
    expect(isPurgeable(junk, ['no-name-no-orders', 'stale-unverified', 'signup-burst'])).toBe(false);
    expect(isPurgeable(junk, [])).toBe(false);
  });
});
