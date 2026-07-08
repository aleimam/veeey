import { describe, it, expect } from 'vitest';
import { SUPPORTED_ACTIONS, isSupportedAction, applyAiProposal } from './ai-apply';

describe('ai-apply whitelist', () => {
  it('exposes the supported actions', () => {
    expect(SUPPORTED_ACTIONS).toContain('product.update');
    expect(SUPPORTED_ACTIONS).toContain('review.moderate');
    expect(SUPPORTED_ACTIONS).toContain('question.answer');
    expect(SUPPORTED_ACTIONS).toContain('cms.update');
    expect(SUPPORTED_ACTIONS).toContain('blog.update');
    expect(isSupportedAction('product.update')).toBe(true);
    expect(isSupportedAction('product.delete')).toBe(false);
  });

  it('refuses an unsupported action without touching the DB', async () => {
    const r = await applyAiProposal('product.delete', { id: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Unsupported');
  });

  it('rejects invalid payloads before touching the DB', async () => {
    const noAnswer = await applyAiProposal('question.answer', { id: 'q1' }); // answer missing
    expect(noAnswer.ok).toBe(false);
    const noKey = await applyAiProposal('cms.update', { titleEn: 'X' }); // id/slug missing
    expect(noKey.ok).toBe(false);
  });
});
