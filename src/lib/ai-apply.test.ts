import { describe, it, expect } from 'vitest';
import { SUPPORTED_ACTIONS, isSupportedAction, applyAiProposal } from './ai-apply';

describe('ai-apply whitelist', () => {
  it('exposes the supported actions', () => {
    expect(SUPPORTED_ACTIONS).toContain('product.update');
    expect(SUPPORTED_ACTIONS).toContain('review.moderate');
    expect(isSupportedAction('product.update')).toBe(true);
    expect(isSupportedAction('product.delete')).toBe(false);
  });

  it('refuses an unsupported action without touching the DB', async () => {
    const r = await applyAiProposal('product.delete', { id: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Unsupported');
  });
});
