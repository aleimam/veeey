# Veeey storefront

Premium bilingual (Arabic / English, full RTL) B2C storefront for imported supplements and
health devices — EGP, expiry-shown / price-per-expiry, loyalty tiers, UltraFast delivery.
Next.js 16 (App Router) · TypeScript (strict) · Prisma 7 + PostgreSQL · Auth.js · next-intl ·
Tailwind v4 · pg-boss.

> **Authoritative docs** live at the repo root: [`AGENTS.md`](AGENTS.md) (build conventions —
> read first), [`VEEEY_PRD.md`](VEEEY_PRD.md) (requirements), [`VEEEY_SPEC.md`](VEEEY_SPEC.md)
> (architecture), [`BUILD_PLAN.md`](BUILD_PLAN.md) (phases), [`DEPLOYMENT.md`](DEPLOYMENT.md)
> (production), [`PROJECT_STATUS.md`](PROJECT_STATUS.md) (what's live now).

---

## Prerequisites

- **Node.js 20+** (22 recommended — see [`.nvmrc`](.nvmrc); `nvm use` picks it up).
- **PostgreSQL 14+** running locally (or a reachable connection string).
- **git**. This is a private repo — you need access to clone, or copy the folder.

No global installs beyond Node + Postgres; everything else is in `package.json`.

## Quick start (fresh clone / another account on this machine)

```bash
# 1. Install deps. `postinstall` runs `prisma generate`, so the DB client is built for you.
npm install

# 2. Environment. Copy the template and fill in at least DATABASE_URL + AUTH_SECRET.
cp .env.example .env
npx auth secret            # writes AUTH_SECRET into .env (or paste your own)
#  then edit .env → point DATABASE_URL at your local Postgres

# 3. Create the database, then apply all migrations + seed synthetic data.
createdb veeey             # or: psql -c 'CREATE DATABASE veeey;'
npx prisma migrate deploy  # applies committed migrations (use `migrate dev` when editing the schema)
npm run db:seed            # synthetic catalog/customers — NEVER load real PII here (AGENTS.md #3)

# 4. Run it.
npm run dev                # storefront + admin at http://localhost:3000
npm run worker             # (separate terminal) background jobs: emails, alerts, crons
```

Open http://localhost:3000 (storefront) and http://localhost:3000/en/admin (admin).
The seed creates a staff login — see `prisma/seed.ts` for the credentials.

Nothing in the checkout is tied to a machine or OS account: all paths are relative, secrets come
from `.env` (gitignored) or the admin panel, and the DB URL is the only host-specific value.

## Environment variables

Everything the app reads is documented in [`.env.example`](.env.example), grouped and commented.
Only `DATABASE_URL` and `AUTH_SECRET` are required to boot. **Most integration secrets
(payments, shipping, email/SMTP, SMS, AI, Google/GA4) can be set in the Admin panel instead of
`.env`** — the DB-stored value takes precedence. Never commit real secrets; `.env*` is gitignored
(except this template).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run worker` | pg-boss worker (notifications, alerts, review/cart/audit crons) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run test` / `test:watch` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end |
| `npm run db:generate` / `db:migrate` / `db:seed` | Prisma client / migrate dev / seed |
| `npm run mock:yeldnin` | Local YeldnIN mock receiver (integration dev) |

**Verify gate** (run before every commit; CI runs the same):
```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## Project layout

```
prisma/            schema.prisma · migrations (committed) · seed.ts
src/app/[locale]/  routes — (shop) storefront · (account) portal · admin dashboard · api
src/lib/           business logic (*-service.ts) — keep logic out of components
src/components/    UI (storefront/ + admin/)
src/worker.ts      background job worker (pg-boss)
messages/          next-intl bundles (en.json / ar.json)
```

## Conventions (see [`AGENTS.md`](AGENTS.md) for the full list)

- Bilingual EN/AR + RTL from day one; no hard-coded user-facing strings.
- Money is **EGP integer piastres (BigInt)** — never floats.
- **Lots are the inventory spine** (product × expiry × location, FEFO).
- RBAC-gate + audit-log every admin write; validate all input (zod).
- Business numbers (tiers, fees, rates) are admin-configurable with seeded defaults — never
  hard-coded. Migrations are committed + hand-written idempotent (never edit a deployed one).

## Deployment

Production runs on a single server via `pm2` (web + worker). See [`DEPLOYMENT.md`](DEPLOYMENT.md)
for the recipe (`git pull && npm install && npx prisma migrate deploy && npm run build && pm2 reload`).
