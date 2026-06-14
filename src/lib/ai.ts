import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude AI helpers (FR-QUIZ-03, FR-REV-04). Env-gated by ANTHROPIC_API_KEY —
 * every function degrades to `null` when the key is absent, so the app runs
 * fully without AI and gets richer with it. Uses the official Anthropic SDK.
 * Per AGENTS.md §8, high-impact AI writes stay human-gated; these are
 * assistive (quiz drafts, review summaries) and reviewed before publishing.
 */
const MODEL = 'claude-opus-4-8';

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

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
  const c = client();
  if (!c) return null;
  try {
    const res = await c.messages.create({
      model: MODEL,
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
  const c = client();
  if (!c || reviews.length === 0) return null;
  const sample = reviews.slice(0, 40).map((r) => `(${r.rating}/5) ${r.body}`).join('\n');
  try {
    const res = await c.messages.create({
      model: MODEL,
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
