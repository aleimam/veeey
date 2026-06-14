# Veeey — Deployment & Staging Runbook

Get the verified codebase (P0–P15) running where you and your team can use it.
Two stages: **(1) push to GitHub**, **(2) stand up a staging environment**
(Vercel + managed Postgres). Everything external is env-gated and off by default,
so a minimal staging deploy needs only **three** environment variables.

Prerequisites: Node ≥ 20, a GitHub account, a Vercel account, and a managed
Postgres (Neon or Supabase free tier are fine).

---

## 1. Push to GitHub (one-time)

The repo is committed locally (4 commits on `master`) but has **no remote**.
`gh` isn't installed here, so create the repo in your account, then push.

1. On GitHub: **New repository** → name `veeey` → **Private** → **do not** add a
   README/.gitignore/license (the repo already has them; an extra commit causes a
   conflict).
2. From `C:\Claude\eCommerce\veeey`:

   ```bash
   git remote add origin https://github.com/<you>/veeey.git
   git push -u origin master
   ```

   (If your default-branch policy prefers `main`: `git branch -M main && git push -u origin main`.)

> Nothing sensitive ships: `.env`/`.env.local` are git-ignored, only `.env.example`
> is tracked, and there is no real customer data in the repo (synthetic seeds only).
> CI (`.github/workflows/ci.yml`) runs tsc + lint + tests + build on every push.

---

## 2. Stand up staging

### 2a. Provision Postgres

Create a Postgres database (Neon/Supabase) and copy its connection string
(include `?sslmode=require`). This becomes `DATABASE_URL`.

### 2b. Apply the schema + (optional) seed

From your machine, pointing at the new DB:

```bash
# apply all committed migrations (no data)
DATABASE_URL="postgres://…?sslmode=require" npx prisma migrate deploy

# OPTIONAL — load the synthetic catalog/tiers/shipping/admin user for a usable demo
DATABASE_URL="postgres://…?sslmode=require" npm run db:seed
```

The seed creates an admin login (`admin@veeey.test` / `Admin12345!`) and a small
synthetic catalog. **Never seed a database that will hold real data.**

### 2c. Deploy on Vercel

1. **Vercel → Add New → Project → Import** your `veeey` repo. It auto-detects
   Next.js; no build-command overrides needed (`postinstall` runs `prisma generate`).
2. Add the environment variables below (Project → Settings → Environment Variables).
3. **Deploy.** Open the URL → you should see the bilingual storefront.

### 2d. Walk the flows

- Storefront: `/` → `/products` → a product page → add to cart → `/checkout`.
- Admin: `/en/admin` (sign in with the seeded admin) → Orders, Inventory, Analytics.
- Switch locale to `/ar` to confirm RTL.

---

## Environment variables

### Required (minimal staging)

| Var | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string (`?sslmode=require`). |
| `AUTH_SECRET` | Generate with `npx auth secret`. Auth.js session signing. |
| `NEXT_PUBLIC_SITE_URL` | Public base URL, e.g. `https://veeey-staging.vercel.app` (feeds, sitemap, emails). |

That's enough for a working storefront + admin. Everything below is optional and
**off until set** — turn them on one at a time and verify each.

### Optional — turn on per feature

| Feature | Vars |
|---|---|
| AI (quizzes, review summaries) | `ANTHROPIC_API_KEY` |
| Transactional email | `RESEND_API_KEY`, `EMAIL_FROM` |
| Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Analytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_CLARITY_ID` |
| Bot protection | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_MIN_SCORE` |
| Social login | `AUTH_GOOGLE_ID/SECRET`, `AUTH_FACEBOOK_*`, `AUTH_APPLE_*`, `AUTH_TWITTER_*` |
| AI-MCP read API | `MCP_API_SECRET` (unset = `/api/mcp/*` returns 503) |
| Payments (later) | `KASHIER_API_KEY`, `OPAY_*` |

### Keep OFF in staging (gated phases)

| Var | Keep |
|---|---|
| `INTEGRATION_ENABLED` | `0` — YeldnIN integration stays disabled until the contract is re-baselined. |
| `TRANSITION_MIRROR` | unset — WooCommerce parallel-run (P16) is cutover-only. |

---

## Background worker (optional)

`pg-boss` powers async notifications + the wishlist-alert sweep, but the app
**works without it** (jobs run inline as a fallback). Vercel's serverless model
doesn't host long-running workers, so when you want true async + the recurring
sweep, run the worker on a small always-on host (Railway/Render/a VM):

```bash
DATABASE_URL=… npm run worker
```

---

## Post-deploy smoke checklist

- [ ] Home, a product page, search, and `/ar` (RTL) all render.
- [ ] Admin sign-in works; Orders/Inventory/Analytics load.
- [ ] `GET /sitemap.xml`, `/robots.txt`, `/feeds/google.xml` return XML.
- [ ] `GET /api/mcp/catalog` → 503 (until `MCP_API_SECRET` is set) — confirms gating.
- [ ] Place a test order end-to-end; check it in admin Orders.
- [ ] (If email/push/AI keys set) trigger each once and confirm delivery.

---

## Notes

- **Migrations on deploy:** run `prisma migrate deploy` against the prod DB before/at
  release (it's not auto-run by the Vercel build). Add it to your release step once
  you have a pipeline.
- **Prisma:** uses the driver adapter + `DATABASE_URL` (read via `prisma.config.ts`);
  the build itself doesn't need a live DB, runtime does.
- **Custom domain:** when ready, point it in Vercel and update `NEXT_PUBLIC_SITE_URL`.
- **Product images:** add CDN hostnames to `images.remotePatterns` in `next.config.ts`
  before serving migrated product images.
