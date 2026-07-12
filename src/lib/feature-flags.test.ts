import { describe, it, expect } from 'vitest';
import { FEATURES, FEATURE_IDS, featureSettingKey, isEnabledValue, featureEnabled, featureForPath, stripLocale, isHrefDisabled, type FeatureId } from './feature-flags';

describe('feature-flags registry', () => {
  it('has unique ids and non-empty bilingual labels', () => {
    expect(new Set(FEATURE_IDS).size).toBe(FEATURE_IDS.length);
    for (const f of FEATURES) {
      expect(f.label[0]).toBeTruthy();
      expect(f.label[1]).toBeTruthy();
      expect(f.description[0]).toBeTruthy();
    }
  });

  it('everything defaults on', () => {
    expect(FEATURES.every((f) => f.default)).toBe(true);
  });
});

describe('isEnabledValue', () => {
  it('uses the default when unset', () => {
    expect(isEnabledValue(undefined, true)).toBe(true);
    expect(isEnabledValue('', false)).toBe(false);
  });
  it('only explicit off values disable', () => {
    for (const off of ['off', 'OFF', 'false', '0', 'no']) expect(isEnabledValue(off, true)).toBe(false);
    for (const on of ['on', 'true', '1', 'yes', 'anything']) expect(isEnabledValue(on, false)).toBe(true);
  });
});

describe('featureEnabled', () => {
  it('reads the feature.<id> key with default fallback', () => {
    expect(featureEnabled({ [featureSettingKey('refill')]: 'off' }, 'refill')).toBe(false);
    expect(featureEnabled({}, 'refill')).toBe(true); // default on
  });
});

describe('featureForPath', () => {
  it('maps owned routes to their feature (longest prefix wins)', () => {
    expect(featureForPath('/refill')).toBe('refill');
    expect(featureForPath('/blog/some-post')).toBe('blog');
    expect(featureForPath('/learn')).toBe('blog');
    expect(featureForPath('/play/find-your-supplement')).toBe('quizzes');
    expect(featureForPath('/special-order')).toBe('specialOrders');
  });
  it('returns null for unowned paths and avoids false prefixes', () => {
    expect(featureForPath('/products')).toBeNull();
    expect(featureForPath('/selection')).toBeNull(); // not /select
    expect(featureForPath('/')).toBeNull();
  });
});

describe('stripLocale + isHrefDisabled', () => {
  const states = Object.fromEntries(FEATURE_IDS.map((id) => [id, true])) as Record<FeatureId, boolean>;
  it('strips a leading locale segment', () => {
    expect(stripLocale('/en/refill')).toBe('/refill');
    expect(stripLocale('/ar/blog/x')).toBe('/blog/x');
    expect(stripLocale('/refill')).toBe('/refill');
  });
  it('flags hrefs whose owning feature is off, honoring the locale prefix', () => {
    expect(isHrefDisabled('/en/refill', { ...states, refill: false })).toBe(true);
    expect(isHrefDisabled('/refill', states)).toBe(false);
    expect(isHrefDisabled('/products?kind=SUPPLEMENT', { ...states, refill: false })).toBe(false);
    expect(isHrefDisabled('#', states)).toBe(false);
  });
});
