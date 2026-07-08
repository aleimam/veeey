# Veeey — Project Status & Handoff

> Living status/handoff doc. Repo-committed so it travels with the code (unlike
> per-user assistant memory). Update it when features ship or the backlog changes.
> **Last updated: 2026-07-08 (night — staff-orders epic Phases A/B/C complete & DEPLOYED).** Authoritative product docs: `VEEEY_PRD.md`,
> `VEEEY_SPEC.md`, `BUILD_PLAN.md`, `AGENTS.md`, `DEPLOYMENT.md`.

## Current state
- **Live** at **veeey.com**. Latest deployed commit: **`db68345`** (2026-07-08). All
  **31 Prisma migrations applied**; `pm2` processes `veeey` + `veeey-worker` healthy; `/api/health` → `{"status":"ok"}`.
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

### Deprioritized by owner (do not re-propose unless asked)
- **Real Autoship/Refill subscriptions** (epic #119) — owner said "ignore refill epic" (2026-07-08); buy-box subscribe-&-save stays visual-only.
- **TEAM departments epic** — postponed by owner.

### Owner in-admin / content actions (not code)
Run **Reviews sync** (seed from Egypt Vitamins); backfill product/deal/hero **images**; populate product
**attributes** (goal/form/dietary) so PLP facets fill; restructure **`/p/faq`** into h2/h3; **enable** the
Learn/Blog + trust-row sections in `/admin/homepage`; add **brand logos/stories**; set **`store.phone`**;
category-structure import + admin renames ("Contact Us"/"Veeey Rewards"); toggle **`preorderEnabled`** per product.
Optional: create an **AI key** in `/admin/ai-keys`; paste GA4/GTM/Search-Console ids in `/admin/google`.

## Recently shipped (this cycle, all deployed 2026-07-08)
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
| **Staff orders — customer layer (A)** | `9d36718` | order form: customer search (name/email/phone) + quick-create + saved-address pick; `/admin/customers/[id]` profile w/ details + address CRUD |
| **Staff orders — product picker (B)** | `7072a82` | live search (name/SKU/ID/legacy) → per-expiry lot pick (stock+price+condition) or FEFO; over-stock → deduct available + PRE-ORDER shortfall line + `isPreorder` flag + auto-linked SpecialOrder; suggested deposit shown (display-only) |
| **Staff orders — gifts polish (C)** | `2aa5ddf` `e9c5ab5` | gifts at order creation (stock-checked, hidden from customer); Cancel/Refund restocks gifts; remove-&-restock per line; **`GiftMovement` audit migration**; /admin/gifts Low/Out badges + Movements panel; `gifts.lowStockThreshold` setting |
| **GTM Consent Mode v2 option** | `81bd91b` | /admin/google "Tag loading" toggle: gated (default) or always-on with consent defaults denied → auto-upgrade on accept |
| **More AI apply-actions** | `10c092a` | approval inbox can now apply `question.answer`, `cms.update`, `blog.update` (+ scope mapping); review.reply skipped (no reply column) |
| **Audit reports + retention** | `ca87b1e` | worker crons: weekly staff activity email (Mon 06:00 UTC) + daily change-log purge (04:30 UTC); Settings: `audit.weeklyReport` (on), `audit.reportRecipients`, `audit.retentionDays` (365, 0=forever) |
| **SEO epic A — products list tools** | `843517e` | data-quality/sourcing/stock filters (export honors them), bulk price %/±EGP/set + set-origin + purchase-price ops, adjust-ALL-prices panel (typed confirm, fully logged), per-page 25–200, typed bulk-delete guard, `catalog.lowStockThreshold` setting |
| **SEO epic B — editor code mode** | `ab1e538` | `</>` HTML source toggle on all rich editors; inline CSS + `<style>` blocks sanitized & scoped to `.veeey-rich` (pure scoped-css lib + tests) |
| **SEO epic C — full SEO system** | `b76c0a1` `ad500f2` `0a5d5cb` `db68345` | **migration `product_seo_fields`**; bilingual RankMath-style editor (focus keywords, snippet preview desktop/mobile w/ px counters, 12-check 0-100 score, OG/Twitter previews, editable Product JSON-LD, canonical + robots w/ feeds-restriction note); PDP emits canonical/robots/OG/Twitter + merged JSON-LD; **/admin/seo-health** catalog report (EN+AR scores, worst-first, filters) |

## Notes for whoever picks this up
- Assistant memory (per-Windows-user, at `~/.claude/projects/C--Claude-eCommerce/memory/`) has deeper
  per-feature detail (`MEMORY.md` is the index). If you're on a **different Windows user**, that memory
  won't be present — **this doc + the repo docs are the portable source of truth.**
- Build phase-by-phase; verify with the gate above; commit per feature; deploy via `ssh veeey`.
