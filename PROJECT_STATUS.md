# Veeey — Project Status & Handoff

> Living status/handoff doc. Repo-committed so it travels with the code (unlike
> per-user assistant memory). Update it when features ship or the backlog changes.
> **Last updated: 2026-07-08 (evening — PDP per-unit/at-a-glance, Product Q&A, WhatsApp confirmations added; NOT yet deployed).** Authoritative product docs: `VEEEY_PRD.md`,
> `VEEEY_SPEC.md`, `BUILD_PLAN.md`, `AGENTS.md`, `DEPLOYMENT.md`.

## Current state
- **Live** at **veeey.com**. Latest deployed commit: **`66e9537`** (2026-07-07). All
  **28 Prisma migrations applied**; `pm2` process `veeey` healthy; `/api/health` → `{"status":"ok"}`.
- Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Prisma 7 + Postgres ·
  next-intl (AR/EN, RTL) · Tailwind v4. Verify gate: `npm run typecheck && npm run lint && npm run test && npm run build` (214 unit tests green).

## Deploy & server access
- **Passwordless SSH is configured:** `ssh veeey` → `root@204.168.129.186`
  (this PC's `~/.ssh/id_ed25519`, aliased in `~/.ssh/config`). App at `/home/veeey/app`.
  pm2 processes: `veeey` (web), `veeey-worker` (jobs), `yeldnin`. Postgres `veeey` @ localhost:5432. Host runs CWP.
- **Deploy recipe** (idempotent):
  ```bash
  cd /home/veeey/app && git checkout -- package-lock.json && git pull && npm install \
    && npx prisma migrate deploy && npm run build && pm2 reload veeey
  ```
  Verify: `npx prisma migrate status` = "up to date"; fresh `.next/BUILD_ID`; `pm2 jlist`; `https://veeey.com/api/health`.
- **Migration discipline:** NEVER edit a migration that may be deployed — always add a new idempotent one (a prod outage came from rewriting one in place). See `MIGRATION_MAPPING.md` / assistant memory `veeey-migration-discipline`.

## ⚠️ Open security action (owner)
- **Rotate the server SSH key `/root/.ssh/id_rsa`** — its private key was exposed on 2026-07-07.
  Regenerate on the server; if it's the GitHub deploy key, swap it in the repo's Deploy Keys.
  (The `ssh veeey` access above uses a *different* key and is unaffected.)

## Waiting tasks

### Blocked on the owner (decision / account / credentials)
- **Payments Stage B** — live OPay + Kashier checkout; needs **sandbox credentials** (Stage A creds UI done).
- **Trustpilot** homepage strip + TrustBox — needs a **Trustpilot account**.
- **Variant selector** (size/flavor/count) — catalog is single-SKU; needs owner **OK for a schema change**.
- **YeldnIN integration** (epic V) — gated; needs `INTEGRATION_CONTRACT.md` re-baselined.

### Buildable now (no blocker — just not scheduled)
- **Real Autoship/Refill subscriptions** with recurring billing (epic #119; currently visual-only). Design-discuss with the owner first (recurring card billing effectively waits on Payments Stage B; COD-cycle variant possible sooner).
- Extensions to shipped features: more **AI apply-actions** (only `product.update` + `review.moderate` today); **always-on GTM w/ Consent Mode** toggle; **scheduled audit reports + retention policy**.

### Owner in-admin / content actions (not code)
Run **Reviews sync** (seed from Egypt Vitamins); backfill product/deal/hero **images**; populate product
**attributes** (goal/form/dietary) so PLP facets fill; restructure **`/p/faq`** into h2/h3; **enable** the
Learn/Blog + trust-row sections in `/admin/homepage`; add **brand logos/stories**; set **`store.phone`**;
category-structure import + admin renames ("Contact Us"/"Veeey Rewards"); toggle **`preorderEnabled`** per product.
Optional: create an **AI key** in `/admin/ai-keys`; paste GA4/GTM/Search-Console ids in `/admin/google`.

## Recently shipped (this cycle, all deployed)
| Area | Commit | Notes |
|---|---|---|
| External-audit roadmap (P0–P3) + pre-order path | … `448647f` | P0 cart fix (loc_main), reviews, search autocomplete, PDP gallery, PLP facets, trust/content, pre-order deposit |
| V1 Admin Panel | `152fdf3` `36b0da3` `e5eeb1c` `08a1bd4` | dashboard drill-downs, analytics fixes (delivered basis, funnel, conversion clamp) + event instrumentation, orders list, **Returns `ReturnReason`** (+migration) |
| Footer contact icons | `9b95d90` | address/phone/WhatsApp/email as icons |
| **Navigation builder** | `b166332` | admin `/admin/navigation`: edit top bar + mega-menus (labels/links/icons/colors/font incl. any Google font/order); JSON Setting `nav.config` |
| Admin sidebar regroup | `8980b5a` | **Appearance / Content / Integrations & API** groups; Egypt Vitamins kept separate |
| **AI access (MCP)** | `90d3abf` | `/admin/ai-keys` (scoped Bearer keys) + `/admin/ai-approvals` (staged-write approval); `/api/mcp/*`; migration `ai_access` |
| **Google services** + audit CSV export | `66e9537` | `/admin/google` (GA4/GTM/Search Console) + tag injection; change-log **Export CSV** + date filters |
| Homepage builder suite (earlier cycle) | `0922b29`…`a5a9129` | homepage sections toggle/reorder/edit + gadgets; custom landing pages `/l/<slug>` (+`PageLayout` migration); per-block bg/spacing; category+PDP top/bottom block zones; Appearance tokens broadened |
| PDP per-unit price + At-a-glance | `404513e` | "≈ EGP X / serving" in the buy box (live per selected lot); auto-derived icon facts strip (type/pack/dose/supply/weight/origin/genuine) |
| **Product Q&A** | `d9c2187` | PDP ask form + published pharmacist answers; `/admin/questions` moderation (answer / publish / hide); `ProductQuestion` **migration** |
| **WhatsApp order confirmation** | `8917a53` | Meta Cloud API send via existing `/admin/providers` WhatsApp creds; order.placed/shipped WA templates (en/ar); Notification log records outcomes |

## Notes for whoever picks this up
- Assistant memory (per-Windows-user, at `~/.claude/projects/C--Claude-eCommerce/memory/`) has deeper
  per-feature detail (`MEMORY.md` is the index). If you're on a **different Windows user**, that memory
  won't be present — **this doc + the repo docs are the portable source of truth.**
- Build phase-by-phase; verify with the gate above; commit per feature; deploy via `ssh veeey`.
