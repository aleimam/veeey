import { describe, expect, it } from 'vitest';
import { CONFIG_TABLES, isSecretSettingKey, keyOf, stripRow, summarize } from './config-transfer';

describe('isSecretSettingKey — nothing that is a credential may reach the file', () => {
  it('catches every configured provider prefix', () => {
    for (const k of ['smtp.pass', 'sms.apiKey', 'whatsapp.token', 'opay.secretKey', 'kashier.apiKey',
                     'aramex.password', 'smsa.passKey', 'ai.openaiKey', 'google.refreshToken', 'backup.password']) {
      expect(isSecretSettingKey(k), k).toBe(true);
    }
  });

  it('also catches anything that merely LOOKS like a credential, whatever its prefix', () => {
    // The deny-list is prefix-based, so a provider added later would leak. This
    // second net is what stops that being silent.
    expect(isSecretSettingKey('somenewprovider.secret')).toBe(true);
    expect(isSecretSettingKey('foo.apiKey')).toBe(true);
    expect(isSecretSettingKey('x.privateKey')).toBe(true);
    expect(isSecretSettingKey('legacy_password_hash')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSecretSettingKey('SMTP.PASS')).toBe(true);
    expect(isSecretSettingKey('Foo.Token')).toBe(true);
  });

  it('lets real configuration through', () => {
    for (const k of ['nav.config', 'home.layout', 'theme.tokens', 'loyalty.tierWindowDays',
                     'inventory.defaultUnitCostEgp', 'checkout.requireVerification', 'refill.discountPercent']) {
      expect(isSecretSettingKey(k), k).toBe(false);
    }
  });

  it('does not treat a public identifier as a secret', () => {
    // Public ids are configuration and SHOULD move with the store.
    expect(isSecretSettingKey('trustpilot.businessUnitId')).toBe(false);
    expect(isSecretSettingKey('analytics.ga4MeasurementId')).toBe(false);
  });
});

describe('stripRow', () => {
  it('drops ids and row timestamps but keeps the configuration', () => {
    const r = stripRow({ id: 'abc', code: 'CONFIRMED', label: 'Confirmed', createdAt: new Date(), updatedAt: new Date() }, ['id']);
    expect(r).toEqual({ code: 'CONFIRMED', label: 'Confirmed' });
  });

  it('serialises BigInt money so the file is valid JSON', () => {
    expect(stripRow({ pricePiastres: 12345n })).toEqual({ pricePiastres: '12345' });
  });

  it('keeps nulls and false — they are meaningful settings, not absences', () => {
    expect(stripRow({ enabled: false, note: null })).toEqual({ enabled: false, note: null });
  });
});

describe('keyOf', () => {
  it('builds the natural-key lookup used to upsert', () => {
    expect(keyOf({ code: 'COD', label: 'Cash' }, ['code'])).toEqual({ code: 'COD' });
  });
});

describe('the manifest itself', () => {
  it('gives every table a natural key, or an import could not upsert it', () => {
    for (const t of CONFIG_TABLES) {
      expect(t.key.length, t.model).toBeGreaterThan(0);
    }
  });

  it('lists no table twice', () => {
    const models = CONFIG_TABLES.map((t) => t.model);
    expect(new Set(models).size).toBe(models.length);
  });

  it('carries no business data — that comes from the catalog sync, not from here', () => {
    const models = CONFIG_TABLES.map((t) => t.model);
    for (const forbidden of ['product', 'customer', 'order', 'lot', 'review', 'user', 'address']) {
      expect(models, forbidden).not.toContain(forbidden);
    }
  });

  it('carries departments but NOT their membership', () => {
    const models = CONFIG_TABLES.map((t) => t.model);
    expect(models).toContain('department');
    // Who is in a department is data the YeldnIN staff sync rebuilds; copying it
    // would grant people access on a store they were never added to.
    expect(models).not.toContain('departmentMember');
  });
});

describe('summarize', () => {
  it('counts rows and non-empty tables', () => {
    expect(summarize({ setting: 40, tier: 3, redirect: 0 })).toBe('43 row(s) across 2 table(s)');
  });
});

describe('PUBLIC_SETTING_KEYS — the allow-list that stops silent loss', () => {
  it('lets theme.tokens through despite containing "token"', () => {
    // It is the design system: every colour, font and radius. Redacting it would
    // strip the storefront's appearance on import, under a routine-looking notice.
    expect(isSecretSettingKey('theme.tokens')).toBe(false);
  });

  it('is EXACT match — a near-miss still redacts', () => {
    expect(isSecretSettingKey('theme.tokens.secret')).toBe(true);
    expect(isSecretSettingKey('custom.theme.tokens')).toBe(true);
  });
});
