import { describe, it, expect } from 'vitest';
import { pick } from '@/lib/admin-i18n';
import { requestTypeLabel, requestStatusLabel, requestTypeHint } from './request-i18n';
import { REQUEST_TYPES, REQUEST_STATUSES } from './request-logic';

const en = pick('en');
const ar = pick('ar');

describe('request-i18n labels', () => {
  it('gives a distinct non-empty EN + AR label for every type', () => {
    for (const ty of REQUEST_TYPES) {
      expect(requestTypeLabel(en, ty)).toBeTruthy();
      expect(requestTypeLabel(ar, ty)).toBeTruthy();
      expect(requestTypeLabel(ar, ty)).not.toBe(requestTypeLabel(en, ty));
      expect(requestTypeHint(en, ty)).toBeTruthy();
    }
  });

  it('gives a label for every approval status', () => {
    for (const s of REQUEST_STATUSES) {
      expect(requestStatusLabel(en, s)).toBeTruthy();
      expect(requestStatusLabel(ar, s)).toBeTruthy();
    }
  });

  it('falls back to the raw key for unknown values', () => {
    expect(requestTypeLabel(en, 'MYSTERY')).toBe('MYSTERY');
    expect(requestStatusLabel(en, 'SENT')).toBe('SENT');
    expect(requestTypeHint(en, 'MYSTERY')).toBe('');
  });
});
