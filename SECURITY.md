# Security notes

Practical security posture for this repo. See [`AGENTS.md`](AGENTS.md) §"Golden rules" #7–8 for
the build-time rules (RBAC-gate + audit every admin write, validate all input with zod,
rate-limit public/AI endpoints, secrets in env/DB only, AI writes staged for approval).

## Secrets & data

- **No secrets in the repo.** `.env*` is gitignored (except `.env.example`, which is names + empty
  values only). Integration secrets (payments, shipping, SMTP, SMS, AI, Google) live in `.env` or,
  preferably, the **admin panel** (DB Settings) — the DB value wins over env.
- **No real PII in the repo.** The seed is synthetic only. Any migration/import data stays in a
  separate, out-of-repo location and is never committed (AGENTS.md #3).
- Rich user content is stored raw and **sanitized on render** (`sanitizeRichHtml` + scoped CSS);
  never `dangerouslySetInnerHTML` an unsanitized value.

## Dependency advisories (`npm audit`)

`npm audit` currently reports advisories that we intentionally **do not** auto-fix because the only
offered remedy is a major downgrade of the pinned stack (e.g. Next 16 → 9, Prisma 7 → 6), which
would be far more destabilizing than the issue. Current residual (prod deps):

| Package | Severity | Path / notes | Why not fixed |
|---|---|---|---|
| `nodemailer` | high | transitive via `@auth/core` (SMTP command-injection advisory) | No non-breaking upstream fix yet. We don't pass attacker-controlled envelope data to it; addresses come from validated customer/admin records. Track next-auth/@auth/core for a patched release. |
| `next`, `postcss` | moderate | build-chain (PostCSS CSS-stringify XSS) | "Fix" is Next 9 (major downgrade). Build-time only, not a runtime request surface. |
| `prisma`, `@prisma/dev`, `@hono/node-server` | moderate | Prisma **dev-server** middleware | Dev-only; "fix" is Prisma 6 (major downgrade of our Prisma 7 stack). Not in the production runtime. |
| `@auth/core`, `@auth/prisma-adapter`, `next-auth` | moderate | via `nodemailer` (above) | Same root cause; resolves when nodemailer is patched upstream. |

The `dompurify` moderate (transitive via `posthog-js`) **was** patched (3.4.10 → 3.4.11) — the only
advisory with a safe, non-breaking fix. Re-run `npm audit` after any dependency bump and update this
table; apply `npm audit fix` (without `--force`) whenever a safe fix appears.

## Reporting

Email **info@veeey.com** for anything sensitive. Rotate any credential that is ever exposed in a
log, chat, or screenshot immediately.
