import { describe, expect, it } from 'vitest';
import { evaluateRecaptcha, verifyRecaptcha } from './recaptcha';

describe('evaluateRecaptcha', () => {
  it('passes a high score', () => {
    expect(evaluateRecaptcha({ success: true, score: 0.9 }, 0.5)).toBe(true);
  });
  it('fails a low score', () => {
    expect(evaluateRecaptcha({ success: true, score: 0.2 }, 0.5)).toBe(false);
  });
  it('fails when not successful', () => {
    expect(evaluateRecaptcha({ success: false, score: 0.9 }, 0.5)).toBe(false);
  });
  it('passes when no score is present (success is enough)', () => {
    expect(evaluateRecaptcha({ success: true }, 0.5)).toBe(true);
  });
});

describe('verifyRecaptcha', () => {
  it('bypasses when no secret is configured (dev/CI)', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    expect(await verifyRecaptcha(undefined)).toBe(true);
  });
});
