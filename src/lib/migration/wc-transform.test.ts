import { describe, it, expect } from 'vitest';
import { egpToPiastres, analyzeProduct, analyzeCustomer, analyzeOrder, nameImportable } from './wc-transform';

describe('egpToPiastres', () => {
  it('converts float EGP to integer piastres', () => {
    expect(egpToPiastres('123.45')).toBe(12345);
    expect(egpToPiastres('780')).toBe(78000);
  });
  it('returns null for empty / non-numeric', () => {
    expect(egpToPiastres('')).toBeNull();
    expect(egpToPiastres(null)).toBeNull();
    expect(egpToPiastres('abc')).toBeNull();
  });
});

describe('analyzeProduct', () => {
  it('flags a clean product correctly (always regen SKU + kind unknown)', () => {
    const r = analyzeProduct({ id: 1, name: 'فيتامين د3', regular_price: '780', weight: '0.2', global_unique_id: '0123456789012' });
    expect(r.ok).toBe(true);
    expect(r.flags).toContain('sku_regenerated');
    expect(r.flags).toContain('kind_unknown');
    expect(r.flags).not.toContain('missing_ar');
    expect(r.flags).not.toContain('missing_weight');
    expect(r.flags).not.toContain('missing_gtin');
  });
  it('flags gaps + invalid price', () => {
    const r = analyzeProduct({ id: 2, name: 'Vitamin D3', regular_price: '' });
    expect(r.ok).toBe(false);
    expect(r.flags).toContain('validation_error');
    expect(r.flags).toContain('missing_ar');
    expect(r.flags).toContain('missing_weight');
  });
});

describe('nameImportable', () => {
  it('keeps normal English and bilingual names', () => {
    expect(nameImportable('Vitamin D3 5000 IU').ok).toBe(true);
    expect(nameImportable('Omega 3 فيتامين').ok).toBe(true);
    // supplement acronyms must NOT be filtered as gibberish
    expect(nameImportable('NMN').ok).toBe(true);
    expect(nameImportable('B12').ok).toBe(true);
    expect(nameImportable('CoQ10 100mg').ok).toBe(true);
  });

  it('rejects Arabic-only names (no English)', () => {
    expect(nameImportable('فيتامين د3')).toEqual({ ok: false, reason: 'arabic_only' });
    expect(nameImportable('مكمل غذائي')).toEqual({ ok: false, reason: 'arabic_only' });
  });

  it('rejects open / damaged / broken — leading or bracketed, any case', () => {
    for (const n of ['Open Box Vitamin C', '(Open) Vitamin C', '[DAMAGED] Whey', 'damaged - Protein', 'Broken seal Omega', 'Whey Protein (open box)', 'منتج مفتوح']) {
      expect(nameImportable(n).ok, n).toBe(false);
      if (!nameImportable(n).ok) expect((nameImportable(n) as { reason: string }).reason).toBe('condition_tag');
    }
  });

  it('rejects names with no real letters / placeholders', () => {
    expect(nameImportable('').ok).toBe(false);
    expect(nameImportable('   ').ok).toBe(false);
    expect(nameImportable('123').ok).toBe(false);
    expect(nameImportable('###').ok).toBe(false);
    expect(nameImportable('-').ok).toBe(false);
  });

  it('does not mistake a hyphen inside a real name for a condition tag', () => {
    expect(nameImportable('Vitamin-C 1000').ok).toBe(true);
  });
});

describe('analyzeCustomer', () => {
  it('always flags password + needs email', () => {
    const ok = analyzeCustomer({ id: 5, email: 'a@b.com', billing: { phone: '0100', city: 'Cairo' } });
    expect(ok.ok).toBe(true);
    expect(ok.flags).toContain('password_not_migratable');
    const bad = analyzeCustomer({ id: 6, email: '', billing: {} });
    expect(bad.ok).toBe(false);
    expect(bad.flags).toContain('validation_error');
    expect(bad.flags).toContain('missing_phone');
    expect(bad.flags).toContain('missing_city');
  });
});

describe('analyzeOrder', () => {
  it('flags non-EGP, guest, custom status, lot binding', () => {
    const r = analyzeOrder({ id: 9, number: '1009', currency: 'USD', customer_id: 0, status: 'awaiting-shipment', total: '500', line_items: [{ id: 1 }] });
    expect(r.flags).toContain('currency_not_egp');
    expect(r.flags).toContain('guest_order');
    expect(r.flags).toContain('status_unmapped');
    expect(r.flags).toContain('no_lot_binding');
    expect(r.ok).toBe(true);
  });
  it('accepts a clean EGP completed order', () => {
    const r = analyzeOrder({ id: 10, number: '1010', currency: 'EGP', customer_id: 5, status: 'completed', total: '1280', line_items: [] });
    expect(r.flags).not.toContain('currency_not_egp');
    expect(r.flags).not.toContain('status_unmapped');
    expect(r.ok).toBe(true);
  });
});
