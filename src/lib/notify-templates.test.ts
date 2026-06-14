import { describe, expect, it } from 'vitest';
import { renderTemplate } from './notify-templates';
import { channelAllowed, DEFAULT_PREFS, type Prefs } from './notify-prefs';

describe('renderTemplate', () => {
  it('interpolates {{vars}} and tolerates whitespace', () => {
    expect(renderTemplate('Hi {{name}}, order {{ number }} = {{total}} EGP', { name: 'Sara', number: 'VY-1', total: 450 }))
      .toBe('Hi Sara, order VY-1 = 450 EGP');
  });
  it('blanks unknown placeholders', () => {
    expect(renderTemplate('Tracking: {{tracking}}', {})).toBe('Tracking: ');
  });
});

describe('channelAllowed', () => {
  it('respects defaults (marketing off, rest on)', () => {
    expect(channelAllowed(DEFAULT_PREFS, 'ORDER', 'EMAIL')).toBe(true);
    expect(channelAllowed(DEFAULT_PREFS, 'PRICE_DROP', 'PUSH')).toBe(true);
    expect(channelAllowed(DEFAULT_PREFS, 'MARKETING', 'EMAIL')).toBe(false);
  });
  it('channel master switch overrides category', () => {
    const noEmail: Prefs = { ...DEFAULT_PREFS, email: false };
    expect(channelAllowed(noEmail, 'ORDER', 'EMAIL')).toBe(false);
    expect(channelAllowed(noEmail, 'ORDER', 'PUSH')).toBe(true);
  });
  it('category switch gates its type', () => {
    const noBis: Prefs = { ...DEFAULT_PREFS, backInStock: false };
    expect(channelAllowed(noBis, 'BACK_IN_STOCK', 'PUSH')).toBe(false);
    expect(channelAllowed(noBis, 'PRICE_DROP', 'PUSH')).toBe(true);
  });
});
