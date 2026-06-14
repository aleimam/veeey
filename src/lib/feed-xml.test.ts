import { describe, expect, it } from 'vitest';
import { xmlEscape, googleItem, productFeed, type FeedProduct } from './feed-xml';
import { buildFunnel, conversionRate } from './analytics';
import { signPayload, verifySignature } from './hmac';

const p: FeedProduct = { sku: 'VEY-1', gtin: null, title: 'Vitamin C & D', description: 'Boost <immunity>', link: 'https://veeey.com/en/products/vit-c', imageLink: 'https://veeey.com/i.jpg', pricePiastres: 59500, brand: 'NOW', inStock: true };

describe('feed-xml', () => {
  it('escapes XML-unsafe characters', () => {
    expect(xmlEscape(`a<b>&'"c`)).toBe('a&lt;b&gt;&amp;&apos;&quot;c');
  });
  it('builds a google item with price, availability, and identifier_exists', () => {
    const item = googleItem(p);
    expect(item).toContain('<g:id>VEY-1</g:id>');
    expect(item).toContain('<g:title>Vitamin C &amp; D</g:title>');
    expect(item).toContain('<g:price>595.00 EGP</g:price>');
    expect(item).toContain('<g:availability>in_stock</g:availability>');
    expect(item).toContain('<g:identifier_exists>no</g:identifier_exists>'); // no gtin
    expect(item).toContain('<g:brand>NOW</g:brand>');
  });
  it('uses gtin when present', () => {
    expect(googleItem({ ...p, gtin: '0123456789012' })).toContain('<g:gtin>0123456789012</g:gtin>');
  });
  it('wraps items in a valid RSS channel', () => {
    const xml = productFeed('Veeey', 'https://veeey.com', [p]);
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('<item>');
  });
});

describe('analytics funnel', () => {
  it('computes step-over-step conversion', () => {
    const f = buildFunnel({ views: 1000, carts: 200, checkouts: 120, orders: 90 });
    expect(f.map((s) => s.count)).toEqual([1000, 200, 120, 90]);
    expect(f[1].rate).toBeCloseTo(0.2);
    expect(f[3].rate).toBeCloseTo(0.75);
  });
  it('conversionRate guards divide-by-zero', () => {
    expect(conversionRate(90, 1000)).toBeCloseTo(0.09);
    expect(conversionRate(5, 0)).toBe(0);
  });
});

describe('hmac', () => {
  it('verifies a fresh, correctly-signed payload', () => {
    const now = 1_700_000_000_000;
    const body = '{"q":"vitamin"}';
    const sig = signPayload('secret', String(now), body);
    expect(verifySignature('secret', String(now), body, sig, now)).toBe(true);
  });
  it('rejects wrong secret, tampered body, and stale timestamp', () => {
    const now = 1_700_000_000_000;
    const body = '{"q":"vitamin"}';
    const sig = signPayload('secret', String(now), body);
    expect(verifySignature('other', String(now), body, sig, now)).toBe(false);
    expect(verifySignature('secret', String(now), '{"q":"x"}', sig, now)).toBe(false);
    expect(verifySignature('secret', String(now), body, sig, now + 10 * 60_000)).toBe(false);
  });
});
