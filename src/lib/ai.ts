import Anthropic from '@anthropic-ai/sdk';
import { getAiConfig } from '@/lib/provider-config';

/**
 * Claude AI helpers (FR-QUIZ-03, FR-REV-04). The provider key + model are
 * admin-configurable (Admin → Providers, DB) with ANTHROPIC_API_KEY env as the
 * fallback; every function degrades to `null` when AI is off, so the app runs
 * fully without it. Official Anthropic SDK, default model claude-opus-4-8. Per
 * AGENTS.md §8, high-impact AI writes stay human-gated; these are assistive.
 */
async function resolveClient(): Promise<{ c: Anthropic; model: string } | null> {
  const cfg = await getAiConfig();
  return cfg ? { c: new Anthropic({ apiKey: cfg.apiKey }), model: cfg.model } : null;
}

/** Sync env check (tests + quick UI). Use aiConfigured() for the accurate DB-aware status. */
export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function firstText(content: Anthropic.ContentBlock[]): string | null {
  const block = content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text.trim() : null;
}

export type GeneratedQuiz = { titleEn: string; questions: { q: string; options: string[] }[] };

const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    titleEn: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { q: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
        required: ['q', 'options'],
        additionalProperties: false,
      },
    },
  },
  required: ['titleEn', 'questions'],
  additionalProperties: false,
} as const;

/** Draft a fun multiple-choice quiz from a topic. Returns null if AI is off. */
export async function generateQuiz(topic: string, count = 5): Promise<GeneratedQuiz | null> {
  const r = await resolveClient();
  if (!r) return null;
  try {
    const res = await r.c.messages.create({
      model: r.model,
      max_tokens: 2000,
      output_config: { format: { type: 'json_schema', schema: QUIZ_SCHEMA } },
      messages: [{
        role: 'user',
        content: `Create a fun, factual ${count}-question multiple-choice quiz about "${topic}" for Veeey, a premium supplements & wellness store. Each question has 3-4 plausible options. Keep it light and on-brand. Return JSON only.`,
      }],
    });
    const text = firstText(res.content);
    return text ? (JSON.parse(text) as GeneratedQuiz) : null;
  } catch {
    return null;
  }
}

/** Summarize customer reviews into a short neutral blurb. Null if AI off / no reviews. */
export async function summarizeReviews(productName: string, reviews: { rating: number; body: string }[]): Promise<string | null> {
  if (reviews.length === 0) return null;
  const r = await resolveClient();
  if (!r) return null;
  const sample = reviews.slice(0, 40).map((rv) => `(${rv.rating}/5) ${rv.body}`).join('\n');
  try {
    const res = await r.c.messages.create({
      model: r.model,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Summarize these verified customer reviews of "${productName}" in 2-3 neutral sentences, covering common pros and cons. Do not invent facts not present in the reviews. Reviews:\n${sample}`,
      }],
    });
    return firstText(res.content);
  } catch {
    return null;
  }
}
