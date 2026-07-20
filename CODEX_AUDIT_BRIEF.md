# Codex Deep Audit Brief — Veeey

> Hand this file to Codex as the task brief. It is self-contained: Codex reads
> this + the repo. Run it as **repeated focused passes** (§9), not one giant
> sweep — one long session dilutes its own context and starts pattern-matching
> instead of reading.

---

## 0. Your job

Perform an exhaustive audit of a **production** bilingual e-commerce codebase and
produce two things:

1. **Defects** — real bugs that lose money, corrupt inventory, leak data, break
   auth, or show users something wrong (engineering **and** UI/UX).
2. **Enhancements** — concrete, prioritized improvements to UI/UX.

Depth over breadth. Do not stop early. A finding you cannot trace to a concrete
failure is not a finding.

---

## 1. Orientation — do this before judging any code

1. Read **`AGENTS.md`** (build rules, stack pins, conventions — authoritative).
2. Read **`PROJECT_STATUS.md`** (shipped feature inventory, deploy gotchas, and
   code lessons that already bit this team).
3. Skim **`prisma/schema.prisma`** for the domain model.
4. Run `npm run typecheck` and `npm run test` to learn the baseline
   (~595 tests should pass). A reviewer who can't run the suite is guessing.

---

## 2. Stack facts — this is NOT the Next.js in your training data

- **Next.js 16 App Router.** Turbopack is default. `middleware` is
  **`src/proxy.ts`**. `params` / `searchParams` / `cookies()` / `headers()` are
  **Promises** — always awaited.
- **Prisma 7** with the `prisma-client` generator: import from
  `@/generated/prisma/client`; driver adapter `@prisma/adapter-pg`; DB URL lives
  in `prisma.config.ts`, not the schema.
- **next-intl**, EN + AR with full **RTL**. `<Link>` from `@/i18n/navigation`
  **prepends the locale** — passing `` `/${locale}/x` `` is a bug (`/en/en/x`).
  Plain `<a>` and `redirect()` from `next/navigation` **do** need the prefix.
- **Money is always integer piastres as `BigInt`.** Any float/Number arithmetic
  on money is a finding.
- **pg-boss** worker (`src/worker.ts`) runs the crons. **vitest** for units.
- **One repo powers TWO live stores.** Many features are gated by env vars or DB
  `Setting` rows and are intentionally inert on one store. **Dormant ≠ dead.**

---

## 3. Hard constraints

- **READ-ONLY.** Do not modify source, commit, push, deploy, or run migrations.
- **Never** read or copy `Imports/` (raw customer PII). Never touch `.env`
  values, production databases, or remote servers.
- Only run local read-only commands (tests, typecheck, grep, analysis scripts).
- The app likely **cannot run locally** (no local Postgres). Do UI review
  statically from components + Tailwind classes + `messages/*.json`. If you
  reference the live public storefront, **do not authenticate, submit forms, or
  place orders**.

---

## 4. Part A — Engineering audit

**P0 — money, data integrity, security**
1. **Money math**: pricing, tier prices, discounts, deposits, refunds, loyalty
   points/redemption, rounding, `BigInt`↔`Number` coercion, mixed units.
2. **Inventory**: lot/FEFO allocation, stock claims, oversell races, reservation
   expiry, stocktake reconcile, stock writeback deltas (must be exactly-once).
3. **Order lifecycle**: status transitions, effects running exactly once
   (restock / points / revenue), cancel & refund reversal, CAS/transaction bounds.
4. **AuthZ**: every admin route **and** every server action permission-gated
   server-side, not merely hidden in the UI. Hunt IDOR on orders/customers/
   addresses, open redirects, missing `audit()` on writes.
5. **Privacy**: PII in logs/exports/analytics, consent gating, DSAR erase.
6. **Integrations**: HMAC sign/verify, replay/nonce, idempotency keys, outbox
   backoff/dead-letter, partial-failure recovery. Check conformance against
   `INTEGRATION_CONTRACT.md` and `../INTEGRATION_V2_PRODUCTS_CUSTOMERS.md`.

**P1 — user-visible wrongness**

7. **Concurrency**: double-submit, two customers on the last unit, cron
   reentrancy, worker job overlap.
8. **Query correctness**: wrong date field, wrong status basis, off-by-one
   windows, timezone drift, aggregates that silently exclude rows.
9. **Error handling**: swallowed errors, "best-effort" paths hiding real
   failures, unhandled rejections in the worker.

**P2 — latent**

10. **Performance**: N+1 queries, unbounded `findMany`, missing indexes on hot
    filters, memory blowups in large jobs (16k+ rows).
11. **Security hygiene**: zod validation at every boundary, `$queryRawUnsafe`
    injection, XSS in rendered rich HTML, upload path traversal, rate limits on
    public/AI endpoints, secrets in code or logs.
12. **Drift**: the two stores diverging, docs contradicting code, duplicated logic.

---

## 5. Part B — UI/UX audit (defects **and** enhancements)

### B1. RTL & bilingual correctness — highest-yield area in this codebase
- Directional utilities must be **logical**: `ms-/me-/ps-/pe-/start-/end-/
  text-start/text-end`, not `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right`
  (or must carry an `rtl:` variant).
- **Directional icons must flip** — chevrons, arrows, "back" affordances
  (`rtl:rotate-180` or a locale-aware icon).
- `messages/en.json` vs `messages/ar.json`: missing keys, orphan keys,
  untranslated/placeholder Arabic, English leaking into AR strings.
- Hardcoded user-facing English in components (must go through `t()` / `tb()`).
- Locale-correct numerals, dates, and currency.
- Layouts that assume LTR (absolute positioning, flex order, one-sided borders).

### B2. Design-system conformance
- Storefront uses the Veeey DS tokens (greens / lime / gold / slate) +
  Playfair Display & Montserrat / GE SS Unique & GE Dinar Two. Admin uses the
  shadcn tokens + Poppins/Cairo.
- ⚠️ **`v0-export/` (homepage) and approved screens are LOCKED.** Do **not**
  propose redesigns of them. Report only genuine breakage there.
- Hunt: raw hex bypassing tokens, **`hsl(var(--token))` used against HEX
  tokens** (this exact bug rendered charts invisible here before), one-off
  spacing/radii, inconsistent button/badge variants.

### B3. Responsive
- Audit **320 / 375 / 768 / 1024 / 1440**.
- **No element may expand the page.** (A chart once forced ~240px of horizontal
  page scroll.) Wide content scrolls inside its own container.
- Tables on mobile: scroll or stack — never squash.
- Admin sidebar at ≤lg; drawers/modals on small screens; sticky headers must not
  cover content; touch targets ≥44px.

### B4. Accessibility (target WCAG AA)
- **Keyboard**: every control reachable and operable; a visible `:focus-visible`
  ring **distinct from hover**; logical order; no traps.
- **Semantics**: real `<table>` headers with `scope`, buttons vs links used
  correctly, labels tied to inputs, sane heading hierarchy.
- **ARIA**: accessible names on icon-only buttons, `aria-sort` on sortable
  headers, `aria-current`, `role="status"` for async feedback.
- **Charts/visuals**: text alternative or an `sr-only` data table.
- **Never color-only meaning** (deltas, statuses, severity) — pair with text or
  icon. Check AA contrast in **both light and dark** themes.
- Images: meaningful `alt`; decorative images `aria-hidden`.

### B5. State coverage (the project's own definition of done)
For **every** page and panel, verify all five exist and are correct:
**loading · empty · error · success · permission-denied.**
Flag missing ones. Empty states should guide the user, not dead-end them.

### B6. Flow-level UX — walk these end-to-end
- **Storefront**: browse → filter/search → PDP → cart → checkout (guest *and*
  registered, incl. OTP verification) → confirmation → order tracking.
  The **expiry / price-per-expiry selection on the PDP is this brand's core
  differentiator** — is the chosen lot obvious, preserved into the cart, and
  reflected in the price the customer pays?
- **Account**: orders, addresses, wishlist, tier & benefits, refill management.
- **Admin daily**: process orders, receive stock/lots, handle purchasing
  requests, run a stocktake.
- For each, report: friction, dead ends, unclear errors, destructive actions
  without confirmation, work lost on validation failure, unclear pricing/fees,
  and missing feedback after an action.

### B7. Content & microcopy
- Errors must tell the user **what to do next**, not just what failed.
- Consistent presentation of currency, dates, and expiry.
- Trust signals present where they matter (expiry shown, authenticity,
  UltraFast delivery, returns) — especially PDP and checkout.

### Bug classes already found in this codebase — look for MORE of the same
Hardcoded trend icons ignoring the data's sign · horizontal page overflow from a
chart · un-themed strip in dark mode · tables with no `<thead>` · `outline:none`
with hover-only styling (no focus ring) · color-only severity cues · date-range
controls behaving differently on sibling pages · duplicate rows with no
disambiguation · export links with no download affordance · mobile sidebar that
doesn't collapse.

---

## 6. Do NOT report (intentional here)

- Code that no-ops behind an env var or DB `Setting` (net-sync, the YeldnIN v2
  channel, feature flags, writeback gates) — **dormancy is by design**.
- The storefront `VEY-…` SKU coexisting with a separate numeric integration SKU.
- `Order.placedAt` used instead of `createdAt` — `placedAt` is correct.
- Products filtered by `status != ARCHIVED` (there is no `archivedAt` on Product).
- The `Setting` table having `key` as its primary key with no `id` column.
- Redesigns of `v0-export/` / approved locked screens.
- Style/formatting nits, "consider adding a test", or restating what code does.
- Anything you have not traced to a concrete failure.

---

## 7. Method — this is what makes it deep

- Work **one domain at a time**. For each: read the service → then **every
  caller** → then its tests, before judging.
- **Trace data end-to-end**: where a bad value enters → how it flows → where it
  does damage.
- Before reporting, actively try to **disprove** it: find the guard, the
  caller-side check, the covering test. Discard what cannot fail in practice.
- Write temporary probe/analysis scripts if they help you prove something.
- **Loop** until two consecutive passes over a domain surface nothing new.

---

## 8. Report format

Write **`CODEX_AUDIT_FINDINGS.md`** with three sections.

### Section 1 — Defects (sorted by severity)
```
### [P0|P1|P2] <one-line defect statement>
- Confidence: CONFIRMED (traced) | SUSPECTED (needs human check)
- Type: engineering | ui-ux
- Location: path/to/file.ts:LINE (+ other involved files)
- What's wrong: 1–3 sentences — the mechanism, not a description
- Failure scenario: concrete inputs/state → the wrong output or damage
- Suggested fix: specific and minimal
- Blast radius: who/what is affected in production
```

### Section 2 — UI/UX enhancements (sorted by impact ÷ effort)
```
### <enhancement title>
- Problem it solves: (observed friction, not a preference)
- Proposed change: concrete and specific
- Expected impact: who benefits and how
- Effort: S | M | L
- Touches a LOCKED screen? yes/no  (if yes: flag it, do not design it)
```

### Section 3 — Coverage log
Every file/domain you actually reviewed and what you concluded — **including
areas you checked and found clean.** This is how we know what wasn't looked at.

---

## 9. The pass plan — run each as a SEPARATE session

Same brief every time; change only the `THIS PASS` line.

| # | `THIS PASS:` |
|---|---|
| 1 | checkout + cart + pricing (`checkout-*`, `pricing-service`, coupons, gifts, tier pricing) |
| 2 | inventory — lots, FEFO allocation, reservations, stocktake, expiry, reorder |
| 3 | orders — `order-service` transitions, effects-once, returns/refunds, invoices |
| 4 | auth + RBAC — every `/admin` route and every action in `src/server`; departments-override-role |
| 5 | loyalty + tiers + benefits — points, spend, tier windows, manual locks, benefit gates |
| 6 | integrations — HMAC, outbox, idempotency, conformance to both contracts |
| 7 | net-sync (veeey.net ↔ WordPress) — importer, writeback ledger, crons, safety floors |
| 8 | analytics + reporting — date ranges, status bases, CSV exports, bot filtering |
| 9 | performance + schema — N+1, indexes, unbounded queries, jobs at scale |
| 10 | **UI/UX: RTL + i18n** (§B1) — sweep every component and both message files |
| 11 | **UI/UX: storefront** (§B2–B6) — responsive, a11y, states, PDP→checkout flow |
| 12 | **UI/UX: admin** (§B2–B6) — responsive, a11y, states, daily operator flows |
| 13 | **UI/UX: enhancements synthesis** — turn passes 10–12 into Section 2 |
| 14 | **off-site backup module** (newest code — see §9a) |

### 9a. Pass 14 scope — the off-site backup module

Added after this brief was first written (`prisma/migrations/20260720010000_backup_module`,
`src/lib/backup/{secret-box,backup-logic,backup-service}.ts`, models `BackupConfig` /
`BackupTier` / `BackupRun`). It handles **a stored credential, a full DB dump, and an
outbound file transfer**, so it is worth its own pass. Focus on:

- **Secret handling** (`secret-box.ts`): AES-256-GCM with a key derived from `AUTH_SECRET`
  via HKDF. Confirm the plaintext password can never reach a log, an API/server-action
  response, the admin UI, a `BackupRun.error` string, or an `audit()` payload. Check that
  `decryptSecret` returning `null` (rotated `AUTH_SECRET` / corrupt value) fails **safely
  and visibly** rather than silently attempting an unauthenticated or passwordless connect.
- **Command execution** (`backup-service.ts`): `execFile('pg_dump', …)` and the `tar`
  archive step. Verify no user- or DB-controlled value can reach an argument vector or a
  shell; that `remotePath` / `fileName` cannot traverse (`..`, absolute paths, separators)
  on either the local staging path or the remote SFTP path.
- **Retention deletion** — the single most destructive path here. `keepLast` pruning issues
  remote `client.delete(...)`. Prove it can only ever delete files this module created, in
  the configured directory, and that `keepLast = 0` really means "keep all" and can never be
  read as "delete everything". Check the ordering/selection logic that picks deletion
  candidates (`backup-logic.ts` is pure — read its tests, then look for cases they miss).
- **Scheduling correctness** (`backup-logic.ts`): due-time math across `everyN` / `hourUtc` /
  `weekday` / `dayOfMonth`, DST and timezone drift, `frequency = OFF` never being due, and
  MANUAL staying button-only. Then reentrancy: two worker ticks overlapping, a `RUNNING`
  row never finishing, and whether `lastRunAt` is stamped on failure in a way that skips the
  next window.
- **Failure paths**: temp-dir cleanup on every branch (`fs.rm` in a `finally`), disk pressure
  from a large `FULL` archive, partial/aborted uploads leaving a truncated remote file that a
  later restore would trust, and whether `BackupRun.contents` can ever claim more than the
  archive actually held.
- **AuthZ**: every backup server action and route must be permission-gated server-side
  (§4.4) — this module can exfiltrate the entire database, so treat a missing gate as P0.
- **Restore honesty**: if nothing verifies a produced archive, say so — an untested backup
  is a latent data-loss finding, not a passing check.

---

## 10. Definition of done

- Every pass produced findings **with traces**, plus a coverage log.
- Findings merged, de-duplicated, and severity-sorted into one
  `CODEX_AUDIT_FINDINGS.md`.
- Anything you could not verify is explicitly marked **SUSPECTED**, not asserted.
- You state plainly what you did **not** get to.
