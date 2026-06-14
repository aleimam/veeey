import { describe, expect, it } from 'vitest';
import { daysOfSupply, reorderDueDate, daysUntil } from './replenishment';
import { recommendFromAnswers } from './guided-selling';
import { aiEnabled, generateQuiz, summarizeReviews } from './ai';

describe('replenishment', () => {
  it('computes days of supply from servings and dose', () => {
    expect(daysOfSupply(60, 2, 1)).toBe(30); // 60 servings, 2/day
    expect(daysOfSupply(60, 2, 3)).toBe(90); // 3 units
  });
  it('returns null when inputs are missing or invalid', () => {
    expect(daysOfSupply(null, 2, 1)).toBeNull();
    expect(daysOfSupply(60, 0, 1)).toBeNull();
    expect(daysOfSupply(60, 2, 0)).toBeNull();
  });
  it('schedules reorder ahead of run-out by the lead time', () => {
    const due = reorderDueDate(new Date('2026-01-01T00:00:00Z'), 30, 5);
    expect(due.toISOString().slice(0, 10)).toBe('2026-01-26'); // +25 days
  });
  it('daysUntil is positive in future, negative when overdue', () => {
    expect(daysUntil(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-11T00:00:00Z'))).toBe(10);
    expect(daysUntil(new Date('2026-01-11T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toBe(-10);
  });
});

describe('guided selling', () => {
  it('maps answers to deduped goal slugs', () => {
    expect(recommendFromAnswers({ goal: 'Stronger immunity', concern: 'General wellness', pref: 'Best value' }))
      .toEqual(['immunity', 'energy']);
  });
  it('ignores unknown answers', () => {
    expect(recommendFromAnswers({ goal: 'nope' })).toEqual([]);
  });
});

describe('ai (env-gated)', () => {
  it('is disabled and returns null without an API key', async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(aiEnabled()).toBe(false);
      expect(await generateQuiz('vitamin C')).toBeNull();
      expect(await summarizeReviews('Vitamin C', [{ rating: 5, body: 'great' }])).toBeNull();
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});
