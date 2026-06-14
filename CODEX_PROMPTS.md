# Codex prompts for building Veeey

## 0. Before you start (one-time)
Put at the repo root: `AGENTS.md`, `VEEEY_PRD.md`, `VEEEY_SPEC.md`, `BUILD_PLAN.md`,
`MIGRATION_FINDINGS.md`, `INTEGRATION_CONTRACT.md`, and the `v0-export/` folder.
Then open Codex in that repo. Work **one phase at a time** and review before moving on.

---

## 1. KICKOFF PROMPT (run first — Phase P0 only)

```
You are building "Veeey", a premium bilingual (Arabic/English) Next.js eCommerce storefront.

First, read these files fully before doing anything:
- AGENTS.md (your standing rules — follow them strictly)
- BUILD_PLAN.md (the phased plan)
- VEEEY_PRD.md (numbered requirements — cite FR-IDs)
- VEEEY_SPEC.md (architecture & data model)
- v0-export/ (the LOCKED homepage UI and brand design tokens — reuse, do not redesign)

Then execute PHASE P0 ONLY (repo bootstrap). Do not start P1.

P0 deliverables:
- Next.js (App Router) + TypeScript (strict) + React Server Components.
- Tailwind CSS v4 + shadcn/ui, importing the components and design tokens from v0-export/
  (brand colors: green #48884D/#38764D, lime #D1D725, gold #FFC000, slate #33424F, surface #F4F6F3;
  fonts Poppins + Cairo).
- PostgreSQL + Prisma (empty initial schema + migration tooling).
- Auth.js (NextAuth) wired but minimal; next-intl with en + ar locales and full RTL support; zod.
- vitest + Playwright; CI that runs tsc, eslint, tests, and next build.
- pg-boss installed/configured (job queue, no jobs yet).
- App shell with locale routing (/[locale]/...), a placeholder storefront home, /admin and /account
  route groups, and the design tokens applied.
- .env.example with all needed variables (no real secrets).

Constraints (from AGENTS.md): money is EGP integer piastres, no real customer data, no hard-coded
business numbers, secrets only in env, everything i18n-ready.

End P0 with: a green `next build`, passing CI, and a SHORT summary of what you scaffolded, the exact
versions/libraries you chose, and any decisions or assumptions you made. Then STOP and wait.
```

---

## 2. NEXT-PHASE PROMPT (reuse for P1 → P13, change the phase number)

```
Re-read AGENTS.md and BUILD_PLAN.md. Execute PHASE P<N> ONLY, exactly as described in the
build plan, implementing the referenced FR-IDs from VEEEY_PRD.md.

Rules:
- Build only this phase; do not start the next one.
- Trace every feature to its FR-ID (put IDs in commit messages).
- Do not invent business numbers — make them admin-configurable with seeded defaults; if a value is
  marked open/⚠️ in the PRD, use a sensible default and leave a TODO with the FR-ID.
- Use synthetic seed data only. No real PII.
- Keep any incomplete or external-dependent feature behind a feature flag (default off).
- Definition of done: tsc clean, eslint clean, unit + e2e tests for new logic, migrations + seed
  updated, next build succeeds.

When done, give a SHORT summary: what you built, FR-IDs covered, test coverage added, any deviations
from the PRD (and update the PRD/SPEC doc if behavior legitimately changed), and open questions.
Then STOP and wait for my review.
```

---

## 3. GATED PHASES — do NOT run until told

- **P14 (YeldnIN integration):** only after the contract is re-baselined against the latest YeldnIN.
- **P15 (migration):** only after a fresh data re-export. Runs in a sandbox against real data, never
  in the main dev repo.
- **P16 (transition mirror):** optional Egypt Vitamins ↔ Veeey parallel run; on only after Veeey is
  fully tested; isolated, feature-flagged, removable.

When ready, use the next-phase prompt but add: "The contract/exports have been re-baselined; proceed."

---

## 4. RESUME / RE-ONBOARD PROMPT (if Codex loses context or you start a new session)

```
Read AGENTS.md, BUILD_PLAN.md, and VEEEY_PRD.md. Then inspect the current repo state and
tell me: which phases (P0–P16) appear complete, which is in progress, what's failing (run tsc + tests
+ build), and what the next phase should be. Do not change code yet — just report.
```

---

## Tips
- One phase per prompt. Review the summary, run the app, then say "proceed to P<next>".
- If Codex drifts from the design, point it back to v0-export/ and the FR-ID.
- If it proposes a different library/stack, hold it to AGENTS.md unless you approve a change.
- Keep the docs as the source of truth — when something changes, update the PRD/SPEC, not just code.
```
