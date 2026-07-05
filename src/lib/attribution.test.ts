import { describe, it, expect } from 'vitest';
import { captureAttribution, parseAttribution, deriveSourceKey, sourceLabel, attributionDetail } from './attribution';

const url = (s: string) => new URL(s);

describe('captureAttribution', () => {
  it('captures UTM params and always overwrites (last non-direct touch)', () => {
    const raw = captureAttribution(url('https://veeey.com/en?utm_source=google&utm_medium=cpc&utm_campaign=summer'), null, 'old');
    const a = parseAttribution(raw)!;
    expect(a.source).toBe('google');
    expect(a.medium).toBe('cpc');
    expect(a.campaign).toBe('summer');
    expect(a.landing).toBe('/en');
    expect(a.at).toBeTruthy();
  });

  it('captures ad click-ids without utm params', () => {
    const a = parseAttribution(captureAttribution(url('https://veeey.com/en/products?gclid=abc123'), null, null))!;
    expect(a.clickId).toBe('gclid');
  });

  it('external referrer writes only when nothing is stored yet', () => {
    const first = captureAttribution(url('https://veeey.com/en'), 'https://www.google.com/search?q=vitamins', null);
    expect(parseAttribution(first)!.referrer).toBe('www.google.com');
    // an existing touch is NOT overwritten by a later organic visit
    expect(captureAttribution(url('https://veeey.com/en'), 'https://facebook.com/', first)).toBeNull();
  });

  it('internal referrers and direct hits never write', () => {
    expect(captureAttribution(url('https://veeey.com/en/cart'), 'https://veeey.com/en', null)).toBeNull();
    expect(captureAttribution(url('https://veeey.com/en'), null, null)).toBeNull();
  });

  it('parseAttribution tolerates garbage', () => {
    expect(parseAttribution('%%%not-json')).toBeNull();
    expect(parseAttribution(null)).toBeNull();
  });
});

describe('deriveSourceKey', () => {
  it('classifies Google Ads (paid medium or gclid)', () => {
    expect(deriveSourceKey({ source: 'google', medium: 'cpc' })).toBe('GOOGLE_ADS');
    expect(deriveSourceKey({ clickId: 'gclid' })).toBe('GOOGLE_ADS');
  });

  it('classifies Google Organic (google without paid medium)', () => {
    expect(deriveSourceKey({ source: 'google', medium: 'organic' })).toBe('GOOGLE_ORGANIC');
    expect(deriveSourceKey({ referrer: 'www.google.com' })).toBe('GOOGLE_ORGANIC');
  });

  it('classifies Meta (source, referrer, or fbclid)', () => {
    expect(deriveSourceKey({ source: 'facebook', medium: 'cpc' })).toBe('META');
    expect(deriveSourceKey({ source: 'instagram' })).toBe('META');
    expect(deriveSourceKey({ referrer: 'l.facebook.com' })).toBe('META');
    expect(deriveSourceKey({ clickId: 'fbclid' })).toBe('META');
  });

  it('classifies Referral / Other / Direct', () => {
    expect(deriveSourceKey({ referrer: 'someblog.com' })).toBe('REFERRAL');
    expect(deriveSourceKey({ source: 'newsletter', medium: 'email' })).toBe('OTHER');
    expect(deriveSourceKey(null)).toBe('DIRECT');
    expect(deriveSourceKey({})).toBe('DIRECT');
  });
});

describe('labels + detail', () => {
  it('sourceLabel is bilingual', () => {
    expect(sourceLabel('GOOGLE_ADS', 'en')).toBe('Google Ads');
    expect(sourceLabel('DIRECT', 'ar')).toBe('مباشر');
  });

  it('attributionDetail renders a compact line', () => {
    expect(attributionDetail({ source: 'google', medium: 'cpc', campaign: 'summer', referrer: 'google.com' })).toBe(
      'google / cpc · summer · ref: google.com',
    );
    expect(attributionDetail(null)).toBe('');
  });
});
