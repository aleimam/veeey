# AGENTS.md — Veeey storefront (build conventions for coding agents)

> Place this file at the **repo root**. Codex / any coding agent must read it before working.
> Authoritative product docs live at the **repo root**: **`VEEEY_PRD.md`** (requirements — cite FR-IDs),
> `VEEEY_SPEC.md` (architecture), `MIGRATION_FINDINGS.md` (data — migration phase only),
> `INTEGRATION_CONTRACT.md` (YeldnIN API — integration phase only, after re-baseline).

## What Veeey is
Premium bilingual (AR/EN) B2C storefront for imported supplements + health devices, EGP, replacing
egyptvitamins.com. Differentiators: expiry-shown / price-per-expiry / special-order-with-compensation /
UltraFast 3–6h / loyalty tiers. Integrates with **YeldnIN** (internal ops app) via an event API.

## Tech stack (pinned — do not substitute without approval)
- **Next.js** (App Router) + **TypeScript** (strict) + React Server Components.
- **Tailwind CSS v4 + shadcn/ui** — UI base is `v0-export/` (homepage is LOCKED; reuse its
  components, tokens in `globals.css`, brand colors below). Do not redesign approved screens.
- **PostgreSQL + Prisma** (single source of schema; migrations committed).
- **Auth.js (NextAuth)** — email/password + social (Google, Meta, Apple, X) + guest; reCAPTCHA v3.
- **next-intl** for i18n (AR + EN, full **RTL**). Fonts: storefront Playfair Display + Montserrat
  (Latin) / GE SS Unique + GE Dinar Two (Arabic); admin Poppins + Cairo.
- **zod** validation; **vitest** (unit) + **Playwright** (e2e).
- **pg-boss** (Postgres job queue) for async: notifications, wishlist/back-in-stock alerts, feeds.
- Money is **EGP integers (piastres)** — never floats for currency.

## Brand tokens
**Storefront** follows the **Veeey Design System** handoff (`../veeey-design-system/`, mirrored in
`src/app/globals.css` under the `.veeey-shop` scope): greens `#38764D` / `#48884D` + **emerald CTA
`#235C3C`**, lime `#D1D725` (accent / links / selected), gold `#FFC000` (sale chips + stars, sparingly),
slate `#33424F`, surface `#F4F6F3`, plus washes (`--green-wash`/`--lime-wash`/`--gold-wash`) and a full
status palette. Fonts: **Playfair Display** (display) + **Montserrat** (body); Arabic **GE SS Unique** +
**GE Dinar Two**. Pill motif, 8px radii, soft premium shadows, 150–300ms motion.
**Admin** keeps the original shadcn tokens + Poppins/Cairo — unchanged. Withings-style restraint.

## Golden rules
1. **Build to the PRD.** Every feature traces to an FR-ID; put the ID in PR/commit descriptions.
2. **Don't invent business numbers.** Tiers, discounts, compensation windows, SLAs, points rates are
   **admin-configurable** with seeded defaults — never hard-code. Flag ⚠️ items; don't guess.
3. **No real customer/order data in the repo.** Use synthetic seeds only. Migration is a separate,
   later, sandboxed process against fresh exports at cutover.
4. **YeldnIN integration ships disabled.** Behind `INTEGRATION_ENABLED` (default off); develop against
   a local mock receiver; do NOT build the live integration until the contract is re-baselined.
5. **SKU is the canonical product key.** Generated for new products; legacy WP id retained as
   `legacyWpId`.
6. **Lots are the inventory spine.** Stock = product × expiry × location. FEFO everywhere. The
   selected lot's exact expiry must travel from cart → order → invoice → emails (FR-INV-02).
7. **Security:** secrets in env (`.env`, never committed); validate all input (zod); RBAC-gate every
   admin action; rate-limit public + AI endpoints; audit-log writes.
8. **AI write access is staged:** high-impact actions (publish live, change live price, message
   customers, refunds) require human approval (FR-MCP-03).
9. **i18n from day one** — no hard-coded user-facing strings; AR + EN keys; RTL-safe layout.
10. **Accessibility:** semantic HTML, alt text, focus states, keyboard nav.

## Definition of done (every task / phase)
- `tsc` clean, `eslint` clean, **unit + e2e tests** for new logic, `next build` succeeds.
- Migrations included; seed updated; feature behind a flag if incomplete.
- FR-IDs referenced; docs updated if behavior diverges from the PRD (update PRD/SPEC, don't drift).
- No secrets, no real PII, no hard-coded business constants.

## Repo conventions
- Product docs live at the **repo root** (`VEEEY_PRD.md`, `VEEEY_SPEC.md`, `BUILD_PLAN.md`,
  `MIGRATION_FINDINGS.md`, `INTEGRATION_CONTRACT.md`, `v0-export/`). `/prisma` — schema + migrations + seed. `/src/app` — routes
  (`/[locale]/(shop)` storefront, `/[locale]/(account)` portal, `/[locale]/admin` dashboard,
  `/api` route handlers). `/src/lib/*-service.ts` — business logic (keep logic out of components,
  mirrors YeldnIN's pattern). `/src/components` — UI. `/messages` — i18n.
- Conventional commits; small PRs per FR cluster; never push secrets.

## Work sequencing
Follow `BUILD_PLAN.md` phase by phase. Do not jump ahead to integration/migration. Ask (or
leave a TODO with the FR-ID) when a requirement is ambiguous rather than guessing.

## Next.js 16 / stack specifics (this is NOT the Next.js in your training data)
Breaking changes from older App Router conventions — **read `node_modules/next/dist/docs/` before
writing framework code**. Heed deprecation notices.
- **Turbopack is the default** for `next dev` / `next build` (no `--turbopack` flag). `next lint` was
  removed — lint with `eslint` directly (flat config in `eslint.config.mjs`).
- **`middleware` → `proxy`.** Locale negotiation lives in `src/proxy.ts` (nodejs runtime, no edge).
- **Async request APIs.** `params` / `searchParams` / `cookies()` / `headers()` are Promises — always
  `await` them. Pages/layouts take `params: Promise<{ locale: string }>`.
- **i18n.** All pages live under `src/app/[locale]/`; the locale layout is the root layout (renders
  `<html dir>`); `next-intl` config in `src/i18n/`, messages in `messages/{en,ar}.json`.
- **Prisma 7.** Uses the `prisma-client` generator (output `src/generated/prisma`, import from
  `@/generated/prisma/client`) + the **driver adapter** `@prisma/adapter-pg`. DB URL is in
  `prisma.config.ts` (dotenv), not the schema. Run `prisma generate` (also a `postinstall` hook).
- **pg-boss v12** uses a **named export**: `import { PgBoss } from 'pg-boss'`.
- Keep `cacheComponents`/PPR off unless a phase explicitly adopts it.

## Verify each phase
`npm run typecheck && npm run lint && npm run test && npm run build` must all pass; `npm run test:e2e`
for routes/flows. CI (`.github/workflows/ci.yml`) runs the same gate.
