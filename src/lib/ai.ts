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

export type TranslateOutcome =
  | { ok: true; values: Record<string, string> }
  | { ok: false; reason: 'not_configured' | 'provider_error'; message: string };

/**
 * Like translateToArabic, but says WHY it failed (V7 audit C5). The bulk brand
 * job used to collapse "no key configured" and "provider rejected the call"
 * into one null, so the admin banner could only guess at the cause.
 */
export async function translateToArabicDetailed(fields: Record<string, string>): Promise<TranslateOutcome> {
  const entries = Object.entries(fields).filter(([, v]) => typeof v === 'string' && v.trim());
  if (entries.length === 0) return { ok: true, values: {} };
  const r = await resolveClient();
  if (!r) return { ok: false, reason: 'not_configured', message: 'No AI provider key is configured — add one under Providers → AI.' };
  const out = await callTranslate(r, entries);
  return out;
}

export async function translateToArabic(fields: Record<string, string>): Promise<Record<string, string> | null> {
  const out = await translateToArabicDetailed(fields);
  return out.ok && Object.keys(out.values).length ? out.values : null;
}

async function callTranslate(r: { c: Anthropic; model: string }, entries: [string, string][]): Promise<TranslateOutcome> {
  const schema = {
    type: 'object',
    properties: Object.fromEntries(entries.map(([k]) => [k, { type: 'string' }])),
    required: entries.map(([k]) => k),
    additionalProperties: false,
  } as const;
  try {
    const res = await r.c.messages.create({
      model: r.model,
      max_tokens: 2000,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{
        role: 'user',
        content: `Translate these e-commerce product fields from English to natural Modern Standard Arabic for Veeey, a premium Egyptian supplements & wellness store. Keep brand names, dosages, units, and numbers intact; use a clean marketing tone; do not add or omit information. Return JSON with the same keys. Fields:\n${JSON.stringify(Object.fromEntries(entries))}`,
      }],
    });
    const text = firstText(res.content);
    if (!text) return { ok: false, reason: 'provider_error', message: 'The provider returned an empty response.' };
    return { ok: true, values: JSON.parse(text) as Record<string, string> };
  } catch (e) {
    // The raw provider message names the actual cause (invalid key, quota,
    // model gone, network) — exactly what the admin banner needs to show.
    return { ok: false, reason: 'provider_error', message: e instanceof Error ? e.message : String(e) };
  }
}

export type AttributeSuggestion = { id: string; values: string[] };

/**
 * Suggest attribute values for a batch of products (bulk attribute editor). Given
 * one attribute (its name + the allowed values) and a list of products (name /
 * brand / short description), Claude picks the best-fitting value(s) per product
 * from the allowed set only — or none when unsure. Assistive: staff review before
 * it's applied. Returns null when AI is off. `multi` allows more than one value.
 */
export async function suggestProductAttributes(input: {
  attributeName: string;
  allowed: string[];
  multi: boolean;
  products: { id: string; name: string; brand?: string; desc?: string }[];
}): Promise<AttributeSuggestion[] | null> {
  if (input.products.length === 0 || input.allowed.length === 0) return null;
  const r = await resolveClient();
  if (!r) return null;
  const schema = {
    type: 'object',
    properties: {
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            values: { type: 'array', items: { type: 'string', enum: input.allowed } },
          },
          required: ['id', 'values'],
          additionalProperties: false,
        },
      },
    },
    required: ['picks'],
    additionalProperties: false,
  } as const;
  const list = input.products
    .slice(0, 60)
    .map((p) => `- id=${p.id} | ${p.name}${p.brand ? ` (${p.brand})` : ''}${p.desc ? ` — ${p.desc.slice(0, 200)}` : ''}`)
    .join('\n');
  try {
    const res = await r.c.messages.create({
      model: r.model,
      max_tokens: 3000,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{
        role: 'user',
        content:
          `You are tagging products for "${input.attributeName}" in a premium supplements & health-devices store. ` +
          `For each product, choose ${input.multi ? 'zero or more' : 'exactly one (or zero if truly unclear)'} value(s) STRICTLY from this allowed list — never invent values:\n${input.allowed.map((v) => `• ${v}`).join('\n')}\n\n` +
          `Only pick a value you are confident about from the product name/description; return an empty "values" array when unsure. Products:\n${list}\n\nReturn JSON: { "picks": [{ "id", "values": [] }] }.`,
      }],
    });
    const text = firstText(res.content);
    if (!text) return null;
    const parsed = JSON.parse(text) as { picks?: AttributeSuggestion[] };
    return Array.isArray(parsed.picks) ? parsed.picks : null;
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
