import { describe, expect, it } from 'vitest';
import { canonicalGovernorate } from '../../scripts/fix-address-governorates';

/**
 * The repair that rewrites 6,100+ imported addresses. Every case here is a real
 * value counted in the live `Address` table.
 */
describe('canonicalGovernorate', () => {
  it('resolves WooCommerce state codes, which is what the import actually stored', () => {
    expect(canonicalGovernorate('EGC')).toBe('Cairo');
    expect(canonicalGovernorate('EGGZ')).toBe('Giza');
    expect(canonicalGovernorate('EGALX')).toBe('Alexandria');
    expect(canonicalGovernorate('EGKFS')).toBe('Kafr El Sheikh');
  });

  it('does NOT confuse EGBA with EGBH', () => {
    // The two look interchangeable and are not: per WooCommerce's own
    // states.php, EGBA is Red Sea and EGBH is Beheira. Swapping them would move
    // 65 customers to the wrong side of the country, plausibly enough that
    // nobody would notice until a courier did.
    expect(canonicalGovernorate('EGBA')).toBe('Red Sea');
    expect(canonicalGovernorate('EGBH')).toBe('Beheira');
  });

  it('resolves Arabic and English spellings, including ة/ه variants', () => {
    expect(canonicalGovernorate('القاهرة')).toBe('Cairo');
    expect(canonicalGovernorate('القاهره')).toBe('Cairo');
    expect(canonicalGovernorate('cairo')).toBe('Cairo');
    expect(canonicalGovernorate('CAIRO')).toBe('Cairo');
    expect(canonicalGovernorate('الاسكندريه')).toBe('Alexandria');
    expect(canonicalGovernorate('الغربيه')).toBe('Gharbia');
  });

  it('returns null for a value that is already canonical — nothing to rewrite', () => {
    expect(canonicalGovernorate('Cairo')).toBeNull();
    expect(canonicalGovernorate('Red Sea')).toBeNull();
  });

  it('LEAVES ALONE anything it cannot resolve, rather than guessing', () => {
    // These are all live values. A guess would bury a real data problem under a
    // plausible-looking governorate, and nobody would ever look again.
    for (const junk of ['—', '.', 'Egypt', 'Dubai', 'Amman', 'تبوك', 'مكة المكرمة', 'Tobago', '01068844098', 'KE30', 'DZ-03', 'haram/mansorua/', 'Faisal', 'المقطم', '', '   ']) {
      expect(canonicalGovernorate(junk), junk).toBeNull();
    }
  });

  it('does not treat a district as a governorate', () => {
    // مدينة نصر and التجمع الخامس are districts of Cairo. Promoting them to
    // "Cairo" would silently discard the more precise part of the address.
    expect(canonicalGovernorate('مدينه نصر')).toBeNull();
    expect(canonicalGovernorate('التجمع الخامس')).toBeNull();
    expect(canonicalGovernorate('6th of October')).toBeNull();
  });
});
