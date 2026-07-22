import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import ar from '../../messages/ar.json';
import { PAYMENT_DESCRIPTION_DEFAULTS, PAYMENT_DESCRIPTION_LABELS, paymentDescriptionKey, paymentDescriptionSettings } from './payment-copy';

/**
 * The checkout payment list. Both `payment-method-service` and
 * `settings-service` pull in auth-guards → next-auth, which cannot load under
 * vitest — so the assertions run against the pure copy module those two share.
 */
const CODES = Object.keys(PAYMENT_DESCRIPTION_LABELS);

describe('the payment methods offered at checkout', () => {
  it('offers the three the owner asked for, plus what was already there', () => {
    for (const code of ['MOBILE_WALLET', 'INSTAPAY', 'POS_ON_DELIVERY']) {
      expect(CODES, code).toContain(code);
    }
  });

  it('KEEPS BANK_TRANSFER — past orders carry that code', () => {
    // Splitting the old "Bank Transfer / InstaPay / Wallet" radio must not
    // orphan the orders already placed under it: customerLabel() falls back to
    // the raw code, so dropping it would print "BANK_TRANSFER" on real invoices.
    expect(CODES).toContain('BANK_TRANSFER');
  });
});

describe('per-method descriptions', () => {
  it('every method has one, in both languages', () => {
    for (const code of CODES) {
      expect(PAYMENT_DESCRIPTION_DEFAULTS[code]?.en?.trim(), `${code} EN`).toBeTruthy();
      expect(PAYMENT_DESCRIPTION_DEFAULTS[code]?.ar?.trim(), `${code} AR`).toBeTruthy();
    }
  });

  it('is registered as an editable setting per method per language', () => {
    // The numbers in this copy — wallet number, IPN address, bank account —
    // change without a release, so they must be editable (AGENTS.md #2).
    const keys = new Set(paymentDescriptionSettings().map((s) => s.key));
    for (const code of CODES) {
      for (const loc of ['en', 'ar']) {
        expect(keys.has(paymentDescriptionKey(code, loc)), `${code}.${loc}`).toBe(true);
      }
    }
  });

  it('seeds the setting with the REAL sentence, never an empty default', () => {
    // saveSettings upserts every known key, so a blank default would wipe all
    // seven descriptions the first time anyone pressed Save on the settings page.
    for (const code of CODES) {
      for (const loc of ['en', 'ar'] as const) {
        const def = paymentDescriptionSettings().find((s) => s.key === paymentDescriptionKey(code, loc));
        expect(def?.default, `${code}.${loc}`).toBe(PAYMENT_DESCRIPTION_DEFAULTS[code][loc]);
      }
    }
  });

  it('names the four wallets, since the owner chose text over logos', () => {
    // Without the names a shopper cannot tell whether their own wallet works.
    const enText = PAYMENT_DESCRIPTION_DEFAULTS.MOBILE_WALLET.en;
    for (const w of ['Vodafone Cash', 'Orange Cash', 'Etisalat Flous', 'WE Pay']) {
      expect(enText, w).toContain(w);
    }
  });

  it('states BOTH halves of the POS rule: where it works, and that it is not guaranteed', () => {
    const { en, ar } = PAYMENT_DESCRIPTION_DEFAULTS.POS_ON_DELIVERY;
    expect(en).toContain('Cairo');
    expect(en).toContain('Giza');
    expect(en.toLowerCase()).toContain('available'); // subject to a machine being available
    expect(ar).toContain('القاهرة');
    expect(ar).toContain('الجيزة');
  });
});

describe('checkout labels', () => {
  const label = (m: typeof en, code: string) =>
    (m as unknown as { storefront: { payments: Record<string, string> } }).storefront.payments[code];

  it('translates the two new methods in both languages', () => {
    for (const code of ['MOBILE_WALLET', 'INSTAPAY']) {
      expect(label(en, code), `en ${code}`).toBeTruthy();
      expect(label(ar, code), `ar ${code}`).toBeTruthy();
    }
  });

  it('no longer sells Bank Transfer as a catch-all for InstaPay and wallets', () => {
    // The old label was "Bank Transfer / InstaPay / Wallet" — one radio for three
    // different things, each needing different instructions.
    expect(label(en, 'BANK_TRANSFER')).not.toMatch(/instapay|wallet/i);
    expect(label(ar, 'BANK_TRANSFER')).not.toMatch(/إنستاباي|محفظة/);
  });
});
