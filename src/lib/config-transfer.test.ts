import { describe, expect, it } from 'vitest';
import { CONFIG_TABLES, isSecretSettingKey, keyOf, remapRefs, stripRow, summarize, type RefKind } from './config-transfer';

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

describe('remapRefs — the cuids that would otherwise import as dangling', () => {
  const COLLECTION = CONFIG_TABLES.find((t) => t.model === 'collection')!.portable;
  // Stands in for the target store's dictionary.
  const dict: Record<RefKind, Record<string, string>> = {
    category: { src_cat_immunity: 'immunity' },
    tag: { src_tag_test: 'testosterone' },
    brand: { src_brand_now: 'now-foods' },
    product: { src_p1: 'VEY-1', src_p2: 'VEY-2' },
    attributeValue: { src_av: 'form::Capsule' },
  };
  const lookup = (kind: RefKind, ref: string) => dict[kind][ref] ?? null;

  it('rewrites the scalar rule category', () => {
    const { row, unresolved } = remapRefs({ slug: 'immunity', ruleCategoryId: 'src_cat_immunity' }, COLLECTION, lookup);
    expect(row.ruleCategoryId).toBe('immunity');
    expect(unresolved).toEqual([]);
  });

  it('rewrites ids INSIDE ruleJson, per condition field', () => {
    const { row } = remapRefs({
      ruleJson: {
        match: 'ALL',
        conditions: [
          { field: 'category', op: 'is', value: 'src_cat_immunity' },
          { field: 'brand', op: 'is_not', value: 'src_brand_now' },
          { field: 'attribute', op: 'is', value: 'src_av' },
          // Not a reference at all — free text must survive untouched.
          { field: 'name', op: 'contains', value: 'src_cat_immunity' },
        ],
      },
    }, COLLECTION, lookup);
    const conds = (row.ruleJson as { conditions: { value: unknown }[] }).conditions;
    expect(conds.map((c) => c.value)).toEqual(['immunity', 'now-foods', 'form::Capsule', 'src_cat_immunity']);
  });

  it('reports what it could not resolve instead of guessing', () => {
    // A guessed match would produce a collection listing the WRONG products —
    // silently wrong beats loudly unresolved, so this must never be lenient.
    const { row, unresolved } = remapRefs({ ruleCategoryId: 'gone' }, COLLECTION, lookup);
    expect(unresolved).toEqual(['category:gone']);
    expect(row.ruleCategoryId).toBe('gone');
  });

  it('drops unresolvable entries from an id ARRAY rather than keeping a ghost', () => {
    const { row, unresolved } = remapRefs({ manualOrder: ['src_p1', 'gone', 'src_p2'] }, COLLECTION, lookup);
    expect(row.manualOrder).toEqual(['VEY-1', 'VEY-2']);
    expect(unresolved).toEqual(['product:gone']);
  });

  it('round-trips: keys back to ids reproduces the original row', () => {
    const inverse = (kind: RefKind, key: string) =>
      Object.entries(dict[kind]).find(([, v]) => v === key)?.[0] ?? null;
    const source = { ruleCategoryId: 'src_cat_immunity', manualOrder: ['src_p1', 'src_p2'] };
    const exported = remapRefs(source, COLLECTION, lookup).row;
    expect(remapRefs(exported, COLLECTION, inverse).row).toEqual(source);
  });

  it('is a no-op for tables that reference nothing', () => {
    const row = { key: 'gold', name: 'Gold' };
    expect(remapRefs(row, undefined, lookup)).toEqual({ row, unresolved: [] });
  });

  it('demotes rather than drops, so a half-resolvable collection is visible and fixable', () => {
    expect(COLLECTION?.demoteWhenUnresolved).toEqual({ field: 'status', value: 'DRAFT' });
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
