import { describe, it, expect } from 'vitest';
import { parseAutofillStatus, isAutofillActive, autofillProgressLine, type AutofillStatus } from './attribute-autofill';

const base: AutofillStatus = {
  state: 'running', current: 'Form', attrDone: 1, attrTotal: 4,
  scanned: 120, applied: 95, skipped: 25,
  startedAt: '2026-07-12T10:00:00Z', at: '2026-07-12T10:05:00Z',
};

describe('parseAutofillStatus', () => {
  it('parses valid status and rejects garbage', () => {
    expect(parseAutofillStatus(JSON.stringify(base))?.applied).toBe(95);
    expect(parseAutofillStatus('not json')).toBeNull();
    expect(parseAutofillStatus(JSON.stringify({ state: 'bogus' }))).toBeNull();
    expect(parseAutofillStatus(null)).toBeNull();
  });
});

describe('isAutofillActive', () => {
  it('is active while running with a fresh heartbeat', () => {
    expect(isAutofillActive(base, new Date('2026-07-12T10:08:00Z'))).toBe(true);
  });
  it('goes stale when the heartbeat is old (worker died) so a restart is allowed', () => {
    expect(isAutofillActive(base, new Date('2026-07-12T10:20:00Z'))).toBe(false);
  });
  it('is inactive for done/error/none', () => {
    expect(isAutofillActive({ ...base, state: 'done' }, new Date('2026-07-12T10:06:00Z'))).toBe(false);
    expect(isAutofillActive(null, new Date())).toBe(false);
  });
});

describe('autofillProgressLine', () => {
  it('shows attribute progress while running and totals when done', () => {
    expect(autofillProgressLine(base)).toContain('1/4 attributes — Form');
    expect(autofillProgressLine({ ...base, state: 'done' })).toContain('95 applied');
    expect(autofillProgressLine({ ...base, state: 'error', error: 'AI unavailable' })).toContain('AI unavailable');
  });
});
