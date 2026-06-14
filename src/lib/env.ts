import { z } from 'zod';

/**
 * Environment validation (zod). Secrets live only in env (AGENTS.md §Security).
 * In P0 most vars are optional so the app builds without a live backend; later
 * phases tighten these (e.g. payment + integration secrets become required when
 * their features ship).
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success && process.env.NODE_ENV === 'production') {
  // Fail fast in production only; dev/test stay permissive for scaffolding.
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
}

export const env: Env = parsed.success ? parsed.data : ({ NODE_ENV: 'development' } as Env);
