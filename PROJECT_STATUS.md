# Veeey — Project Status & Handoff

> Living status/handoff doc. Repo-committed so it travels with the code (unlike
> per-user assistant memory). Update it when features ship or the backlog changes.
> **Last updated: 2026-07-09 (V3 admin epic COMPLETE & DEPLOYED — all 3 tracks + rule engine).** Authoritative product docs: `VEEEY_PRD.md`,
> `VEEEY_SPEC.md`, `BUILD_PLAN.md`, `AGENTS.md`, `DEPLOYMENT.md`.

## Current state
- **Live** at **veeey.com**. Latest deployed commit: **`406198c`** (2026-07-09). All
  **35 Prisma migrations applied** (V3 added `collection_v3` + `attribute_v3`); `pm2` processes `veeey` + `veeey-worker` healthy; `/api/health` → `{"status":"ok"}`.

## V3 admin epic (from `V3 admin.docx`) — ✅ COMPLETE & DEPLOYED
Source doc: Tags / Attributes / Collections admin upgrades + collection storefront wiring. Full plan in assistant memory [[veeey-v3-admin-epic]].
- **DONE & DEPLOYED (2026-07-09):**
  - **P0** `654e6e3` shared list UX (aligned filter bar / search-empty state / delete-always-confirms; toolkit-level).
  - **TAG-1** `53c4338` tags usage-count column + missing-AR badge/filter (added `tag`/`category` filter to products admin).
  - **TAG-2** slug UX (live preview + invalid-char + duplicate check via `/api/admin/slug-available`) + unsaved-changes guard + clearer Cancel, all in shared `EntityForm` (SlugField extracted to `slug-field.tsx`).
  - **COL-1** `collection_v3` migration (ruleJson, manualOrder text[], imageAlt EN/AR).
  - **COL-2** searchable manual product picker (drag/↑↓ reorder) + bespoke `CollectionForm` (conditional Manual/Auto display); order saved in `manualOrder`.
  - **COL-3** AR description + banner+alt + meta SEO in the form (no migration — columns existed).
  - **COL-5** storefront `/[locale]/collection/[slug]` + `/collections` index (published-only 404-guard, canonical/hreflang/JSON-LD) — **fixes the 404s**.
  - **COL-6** "Shop by Goal" mega-menu → `/collection/<slug>` + collection display-order + onboarding hint. **Seeded 13 published goal collections on prod** (AUTO, mapped to matching categories; all 12 menu targets return 200 EN+AR). No saved `nav.config` existed, so `defaultNav()` is live.
  - **ATTR-1..4** `2fb466d` (migration `attribute_v3`): Attribute gained inputType (single/multi), multi-kind `kinds` "applies to", description/unit, isFilterable + isRequired; AttributeValue gained slug + sortOrder (per-row slug edit + ↑/↓ reorder). Product picker filters by `kinds`, enforces single/multi + required (server-side, dormant until flagged); PLP facets driven by `isFilterable`. **Seeded 29 standard attributes + 109 values on prod** (`scripts/seed-attributes.ts`; 31 total, 16 filterable, 113 values).
  - **COL-4** `1b1fbf9` `52531e5` (no migration) — attribute-based **rule engine**: pure `collection-rules.ts` (+tests) → RuleConfig (match ALL/ANY + conditions over Category/Tag/Brand/Attribute value/**Name-or-SKU**/Price/Stock, operators is/is-not/**contains/not-contains** (name→nameEn/nameAr/SKU)/>/</between/in-out-of-stock) compiled to a Prisma where; stored in `ruleJson`; resolved via shared `collectionRuleWhere` (falls back to legacy category+tag). Admin `CollectionRuleBuilder` with live "N products match + sample" preview. `52531e5` added the text `contains` field — the last V3-doc operator, so **every doc requirement is now delivered.**
  - **Rule sort + empty-collection fix** `406198c` — added `sort` to the rule engine (Best selling / Newest / Price; pure `ruleOrderBy`) + builder dropdown; **fixed the 5 empty seeded collections on prod** (SQL): beauty=ANY of 4 beauty categories (25), best-sellers=in-stock+bestselling (60), new-arrivals=in-stock+newest (60), testosterone=tag `tagv3_testosterone` on 4 name-matched products (4), bundles-stacks=tag `tagv3_bundle` (1). **All 12 goal collection pages now non-empty.**
- **V3 admin epic is COMPLETE** — all 12 phases (P0, TAG-1/2, ATTR-1..4, COL-1..6) + rule-sort follow-up built, verified, deployed.
- **Owner follow-up (optional):** refine collection banners/curation in `/admin/collections`; tag more bundle products with the `bundle` tag so `bundles-stacks` grows.
- Stack: Next.js 16 (App Router, Turbopack) · TypeScript · Prisma 7 + Postgres ·
  next-intl (AR/EN, RTL) · Tailwind v4. Verify gate: `npm run typecheck && npm run lint && npm run test && npm run build` (243 unit tests green).

## 2026-07-08 hardening pass (3 review agents: security / correctness / recent code)
- **`09cd75a` media durability** — background job (`media-localize` queue) downloads all ~12.8k
  old-CDN (egyptvitamin.b-cdn.net) catalog images → WebP in `public/uploads`, rewrites DB URLs,
  prunes dead links. **Owner action: click "Localize images now" in `/admin/go-live` (Media durability card).**
- **`1a90709` correctness** — atomic stock claims (cart reserve/release, staff-order allocation),
  transitionOrder compare-and-swap (no double restock/points/revenue on double-click), returns-aware
  refund restock (no double count), edit guards on item/gift removal, loyalty net clawback + REDEEM
  refund on cancel, tier-rate pointsEarned, coupon singleUse enforced, non-destructive setCartQty,
  PENDING bulk-delete restocks first, restructure apply = snapshot-first + one transaction + true-slug redirects.
- **`81da59e` security** — 17 admin read pages now enforce the sidebar's permission server-side
  (orders/customers/returns/special-orders/notifications/change-log/users/departments/analytics);
  department permission fallback fixed (zero-perm dept no longer falls back to old role); friendly
  bilingual admin "no access" error boundary; in-process rate limits on login/register/reviews/
  questions/special-orders (reCAPTCHA fails open, so it can't be the only control); order-confirmation
  page gated by `vy_orders` cookie or owning session (numbers were guessable).
- Known accepted leftovers (low): revenue outbox payload uses EGP float (contract-compatible);
  getCart line price shows first lot's price when a product spans differently-priced lots (display
  only); coupon usage limits still check-then-act under extreme concurrency; lifetimeSpend reversal
  uses current total if items were lost after credit.

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
| **SEO — search appearance** | `c905ec5` `2a06c67` `494e824` | fixed homepage `<title>` (Google was showing the Refill tagline — homepage had no metadata) via localized admin-editable homepage SEO (`seo.homeTitle/Desc En/Ar` in /admin/settings) + canonical/hreflang/OG; sitewide **Organization + WebSite (SearchAction)** JSON-LD (`SiteJsonLd`, root layout — logo/social sameAs/WhatsApp contact/Google search box); **BreadcrumbList** on ALL detail/listing pages — PDP, category (nested parent crumb), brand, collection. No migration. **Owner: verify in Google Search Console + submit sitemap + Request-indexing the homepage** |
| **Analytics P5 — server-side GA4 (Measurement Protocol)** | `88e41c6` | new `google.ga4ApiSecret` config (masked field in /admin/google); /api/events forwards mapped ecommerce events to GA4 server-side via `after()` (post-response, never blocks the beacon), gated on full consent + configured id/secret. `ga4-mp.ts` buildMpEvents (reuses P4 mapper, 25-cap) + forwardToGa4 (client_id=session, 3s timeout). +4 tests. Ad-blocker-proof. BigQuery = GA4-console link (owner). No migration. **Owner: add GA4 id + MP API secret in /admin/google to activate.** |
| **Analytics P4 — GTM/GA4 client dataLayer bridge** | `151b321` | `datalayer.ts` maps first-party events → GA4 ecommerce (view_item/add_to_cart/begin_checkout/purchase/search/add_to_wishlist); pushes to window.dataLayer (GTM) + gtag (GA4), wired into provider track() so all instrumented events flow. Purchase fired on completed order (confirmation page) with transaction_id + line items. Consent Mode v2 gates the send. +6 tests. No migration. **Owner: add GA4/GTM id in /admin/google to activate (currently inert).** |
| **Analytics P3 — dashboard v1 (filters/charts/export)** | `4367877` | /admin/analytics rebuilt on P2: 7/30/90-day range selector, traffic + commerce KPIs, SVG traffic chart, funnel + cart/checkout abandonment, audience (device/country/browser/OS), top pages by dwell, product performance (view→buy), top + zero-result searches; RBAC-gated CSV export route (traffic/audience/pages/searches/products, UTF-8 BOM). Report builder = P6. No migration. |
| **Analytics P2 — commerce-joined metrics service** | `8e846f8` | `analytics-insights.ts` (bot-filtered, windowed): visitorTimeSeries (daily, gap-filled), audienceBreakdown (device/country/browser/OS), newVsReturning, engagement (dwell + pages/visitor + bounce + top-pages-by-dwell), cartFunnel (abandonment), searchInsights (top + **zero-result queries**), productPerformance (view→buy rate). Pure helpers (pct/bounce/abandonment/fillDailySeries/topBuckets) + 7 tests. The engine for the P3 dashboard. No migration. Verified live; backfilled `lastSeenAt` on legacy sessions for metric consistency. |
| **Analytics P1 — visitor capture & enrichment** | `a8bbd04` `1b31a46` `0016a47` | **migration `analytics_enrichment`**; server-side ingest now enriches sessions from request headers — IP (x-forwarded-for) + anonymized IP, device/OS/browser (ua-parser-js), bot flag (isbot), city/region/country (maxmind GeoLite2, lazy + graceful when the .mmdb is absent), language, screen/viewport, landing/exit path — **consent-tiered** (coarse non-PII for all; raw IP + geo + customer link only under full consent). Client emits `page_leave` with per-page **dwell time**. Daily **retention purge** cron (`analytics.retentionDays`=90) + `deleteCustomerAnalytics()` DSAR erase. Verified live. **Owner: drop GeoLite2-City.mmdb at `GEOIP_DB_PATH` + update privacy policy.** Part of the phased analytics epic (P2 metrics, P3 dashboard, P4 GTM/GA4 next) — see assistant memory. |
| **Media localization (ran on prod 2026-07-10)** | job `media-localize` | all **12,483** old-CDN catalog images downloaded → WebP → `/uploads`, DB URLs rewritten (remoteMedia now **0** — storefront no longer depends on the dead `egyptvitamin.b-cdn.net`); 8 dead links pruned; **0 published products missing an image**, 14 private (3 real: Ipamorelin, Nordic Naturals D3 Kids, Tesamorelin — add photos before publishing). Note: run exceeds pg-boss's 15-min visibility timeout → re-dispatched (idempotent, harmless); **fixed `e3138c0`** — media-localize + brand-translate now enqueue with `expireInSeconds: 7200, retryLimit: 0` (single clean pass) |
| **V2 — Go-Live page** | `e89a3b7` | layout fix (import panel never clipped), 6 clickable summary cards (+Ready/Published views), counter tooltips, checkbox bulk **Publish selected** + count-confirmed Publish all, combined Add stock + Publish |
| **V2 — Brands** | `6027e4a` `7250a5c` `36b3465` | **migration `brand_category_seo`** (Brand+Category slugAr + full SEO); brand form AR description/slug + entity-aware SEO module (Brand schema); /brands/[slug] full head + JSON-LD; list product counts, completeness filters, **background AR-name translate job**, orphan-guarded delete/archive |
| **V2 — Categories** | `25295df` `e9bb14f` `c89e899` | form AR desc/slug + image uploader + CollectionPage SEO; category-filtered PLP head/JSON-LD + slug URLs; tree view + counts + filters + orphan guards; **restructure dry-run tool at /admin/categories/restructure** (typed-APPLY apply, snapshot in change log, merged cats archived, slug redirects) — **owner: review & Apply in-app** |
| **TEAM — departments replace roles** | `493d512` `c6209dc` | **migration `departments`** (Roles→Departments data copy + Sales seed); union-of-teams permissions at sign-in (legacy-role fallback, sessions unaffected); **/admin/departments** CRUD + permission editor + members; staff form = multi-department checkboxes; order pharmacist picker = Sales members; /admin/roles removed |

## Notes for whoever picks this up
- Assistant memory (per-Windows-user, at `~/.claude/projects/C--Claude-eCommerce/memory/`) has deeper
  per-feature detail (`MEMORY.md` is the index). If you're on a **different Windows user**, that memory
  won't be present — **this doc + the repo docs are the portable source of truth.**
- Build phase-by-phase; verify with the gate above; commit per feature; deploy via `ssh veeey`.
