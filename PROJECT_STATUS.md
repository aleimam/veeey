# Veeey — Project Status & Handoff

> Living status/handoff doc. **Repo-committed so it travels with the code** (unlike per-user
> assistant memory). Update it when features ship or the backlog changes.
> **Last updated: 2026-07-18.** Authoritative product docs: `VEEEY_PRD.md`, `VEEEY_SPEC.md`,
> `BUILD_PLAN.md`, `AGENTS.md` (build rules — read first), `DEPLOYMENT.md`, `SECURITY.md`, `README.md`.

## Current state

- **Live** at **veeey.com** (and veeey.net). Latest deployed commit: **`bb9f010`** (2026-07-18). All
  **59 Prisma migrations applied**; `pm2` `veeey` (web) + `veeey-worker` healthy;
  `/api/health` → `{"status":"ok"}`. Verify gate green: typecheck · lint · **558 unit tests** · build
  (was 537; +the net-sync transform suite). Repo HEAD `0c99328`.
- **🆕 veeey.net now has a REAL catalog (2026-07-19).** The paused veeey.net↔egyptvitamins.net sync
  resumed; **Phase 1 (one-time DB-direct import) is live on veeey.net** (`0c99328`, deployed there only
  — ships inert on veeey.com, no source env): **2,703 products, 3,584 lots** (2,850 live / 734
  expired-kept / 665 non-perishable), **724 brands, 60 categories, 0 errors**, EN + AR overlay, prices
  in piastres, idempotent (re-run = all updates). **Phase 1b images done** (`d23dc13`): 13,475 files
  (1.8 GB) for 2,695 products copied to `public/uploads/net/` (served `/uploads/net/*`); PDPs render
  real images. **Phase 2 sync LIVE** (`74ee3bb`): root crontab runs `scripts/net-sync/sync-cron.sh`
  every 10 min (full hash-diff scan, ~40 s: products/lots/stock + delete-detection with a tested
  < 50%-scan safety floor) + a daily image refresh; `flock`-guarded, WP is stock master, log at
  `/opt/veeey/net-sync.log`. Engine: `src/lib/net-sync/{transform,wp-source,importer,images}.ts` + CLIs
  `scripts/net-sync/{run,run-images}.ts` (env-gated by `NET_SYNC_MYSQL_URL` → inert on veeey.com).
  **Phase 3 writeback LIVE — `NET_SYNC_WRITEBACK=on` (owner-approved 2026-07-19)** (`89c5802`
  migration `net_stock_outbox` = 60th + `e751ab9`): `transitionOrder` → `enqueueWriteback` records
  per-product deltas (SALE on first CONFIRMED/SHIPPED/DELIVERED entry, RESTORE on
  committed→CANCELLED/REFUNDED, exactly-once via the `NetStockOutbox` unique key); `*/2` cron drains
  via wp-cli `wc_update_product_stock`. **Live-fire verified net-zero**: SALE applied WP 28→26/29→28,
  cancel RESTORE brought it back exactly; test artifacts removed. **THE PIPELINE IS COMPLETE** —
  veeey.net mirrors egyptvitamins.net every 10 min and reports its sales back as stock deltas.
  Runbook in `../VEEEY_NET_MIGRATION.md` + `DEPLOYMENT.md` → "Catalog sync (net-sync)".
- **Unified Requests feature — shipped + deployed to BOTH stores 2026-07-18** (Phases A–C, commits
  `661056f`→`bb9f010`; 3 migrations `requests` + `requests_permission` (no-lockout grant) +
  `product_always_needed`). Mirrors YeldnIN's Request model: **`/admin/requests`** with 4 types (Special
  Order / Out of Stock / Restock / Optional) + a PENDING→APPROVED/REJECTED approval gate; the inventory
  suggestion tabs' **Request** button now creates a *typed* Request (supersedes the flat PurchaseRequest;
  the "Requested" count unions both so nothing in flight is lost); **"Place purchasing request"** on the
  admin order page feeds pre-order/special-order purchasing (linked to the order + customer, pre-filled
  from pre-order lines); pre-order/special-order **filters + badges** in `/admin/orders` and the customer
  account (unified tracking); a product-page **Always Needed** flag (settable by admins AND sales via
  `requireAnyPermission(catalog.write | inventory.manage)`) drives a **monthly OPTIONAL refill cron**
  (`optional-refill` queue, resets to target X every 30 days). New permission **`requests.manage`**. The
  `SpecialOrder` sourcing-lead model is separate and untouched. **⚠️ Phase D (live bidirectional YeldnIN
  sync) is intentionally DEFERRED** — local Requests only; the outbox (`Request.outboxEventId`) stays
  dormant behind `INTEGRATION_ENABLED` until `INTEGRATION_CONTRACT.md` is re-baselined (fix
  RESTOCKING→RESTOCK, add OPTIONAL, request.created both ways + lines + photos) and secrets exchanged;
  edits will touch BOTH codebases (YeldnIN at `C:\Claude\YeldnIN`).
  - **UPDATE 2026-07-18 — Phase D BUILT both sides + briefly enabled live, now OFF; catalog sync BUILT (not run).**
    Phase D request-sync shipped both codebases (Veeey `4d44faf`, YeldnIN `995f854`) with a backend on/off toggle
    (`/admin/integration`, Setting `integration.enabled`). Enabling proved HMAC auth + transport (signed `/health`→200)
    but exposed that the two catalogs were **keyed differently** (YeldnIN.sku = WordPress id; Veeey.legacyWpId = same id)
    so request LINES matched nothing → link set OFF both sides. Owner then chose to make **Veeey the catalog MASTER and
    rebuild YeldnIN's catalog from it**. **✅ EXECUTED + LINK LIVE both ways 2026-07-18.** Veeey deployed `74ae3e1`
    (`catalog.upsert`→`/catalog` outbox + `emitCatalogSync`/`backfillCatalog`; PLUS a fix — the backend on/off toggle
    `setIntegrationEnabledAction` now writes the Setting directly because `saveSettings` silently dropped
    `integration.enabled`, a key absent from the SETTINGS registry, so the "disable from backend" switch had been a no-op).
    YeldnIN deployed `394ee53` + migration `20260718134658_product_veeey_wpid` (adds `Product.veeeyWpId` + inbound
    `/api/integration/v1/catalog` `handleCatalogUpsert`). Ran as a **non-destructive mirror**: backup YeldnIN `dev.db` →
    backfill **2,548/2,548 SENT, 0 failed** → YeldnIN 2,679→2,754→cleanup→**2,560 products = 2,548 mirrored from veeey.com
    (all carry Veeey's `VEY-` SKU, `veeeyWpId` linked) + 12 archived (YeldnIN-only w/ live Item/RequestLine deps) + 194
    zero-dep leftovers hard-deleted (28 `P`-seed + 166 non-Veeey numeric-SKU); 0 orphans.** The synced store is
    **veeey.com** (NOT veeey.net — that's a separate box/DB, still empty, unlinked). Request-line SKU matching now works
    (old 422 `no_known_products` cause gone). DB backup: `/home/yeldn/app/prisma/dev.db.bak-catalogsync-1784388313`.
    Disable via `/admin/integration` "Turn off" (now functional) or env `INTEGRATION_ENABLED=0`. Full detail in memory
    `veeey-requests-epic.md`.
- **V7 audit doc (Catalog module, C1–C20) — everything buildable SHIPPED + DEPLOYED 2026-07-17** (source:
  `C:\Claude\eCommerce\V7 Veeey_editable_featues_v3.docx`; 4 commits `063680d` → `ce4ca34`). Triage-first again
  paid off — **6 findings were already shipped or mitigated** (C7 price-tool guard, C8-bulk typedConfirm, C14
  clickable counts, C16 overflow-x, C17 sort toggle, C18 core listQs) and the data claims were re-measured on
  prod before building (C4 shrank to 2 rows; C19's 11 zero-price products are all unpublished).
  - **C1 (`063680d`+`ce7b3e8`, the data migration):** WP entity escapes — **218 products + 6 brands + 14
    categories stored `&amp;` in names**; nothing decoded at ingest, so every sync re-imported them escaped.
    New `decode-entities.ts` (single-pass by design; prod has zero double-escapes) wired into wc-sync
    (names + incoming WC category slug + new-product slugEn) and CSV import; backfill migration cleaned the
    names. ⚠️ **Interlock:** the sync rewrites nameEn every run and matches categories by slug — decoders and
    backfill MUST ship together or the sync re-escapes/duplicates. Verified post-deploy: 0 escaped names left.
  - **C4/C6 (same commits):** the 2 percent-encoded category slugs re-slugged to decoded Arabic (encoded slugs
    can never match — Next decodes query params) + `pain-releif`→`pain-relief` (both twins) + 4 guarded
    Redirect rows in the loader's `/products?category=` format; **saveCategory now auto-creates a Redirect on
    slug rename** (collapses chains, drops self-rows — previously only the restructure tool preserved links)
    and both category/brand saves decode percent-encoded slug input. Old + new links both 200 on prod.
  - **C8-row/C2/C5/C18 (`5537fce`):** the products row Delete fired on ONE click → now a named ConfirmButton
    (component existed, page never used it). Brand filter = new `ComboFilter` (FilterBar `combo` type,
    type-to-filter listbox + combobox ARIA; hidden input keeps the same `?brand=` param). Translate job:
    `translateToArabicDetailed` typed outcome — aborts up-front on missing key with the message, retries
    transient provider errors 2× with backoff, banner shows the provider's actual error (+ partial-failure
    notice). Products FilterBar `keep`s link-set tag/category (same bug class V6 fixed on Orders).
  - **C15/C13/C9/C19/C10 (`ce4ca34`):** products table scrolls in its own max-height container with a sticky
    thead (sticky can't engage in a plain overflow-x wrapper) — BulkBar stays visible above the scroll region;
    opt-in **Stock & Margin columns** (`?cols=inv`, listQs-carried; margin = base price − weighted-average LIVE
    lot cost, dash when uncosted, red when negative, explicitly "indicative" — storefront sells per-lot; NOT
    sortable: aggregate sort needs raw SQL, out of scope; pure math in `inventory-columns.ts`); `Field`
    `required` marker wired through every EntityForm type; 0-EGP save confirm; edit/new breadcrumbs via prefix
    rules in admin-shell.
  - **Still OWNER-BLOCKED:** C3/C11/C12 taxonomy merges (19 EN/AR twin top-level cats — 72 top-level total;
    "Public Health" = 596 products; reuse `/admin/categories/restructure`), **C20** (audit wants the rich-text
    font/size pickers removed but SEO-B built them at the owner's request — decide), the **AI key** (C5 root
    cause), and the **198 product slugs polluted with a stray `-amp-` word** (escape leaked into slug
    generation at import; renaming = 198 indexed-URL redirects + SEO churn — owner's call, not bundled).
- **V6 audit doc (Sales & customers analytics page) FULLY shipped 2026-07-17** (source:
  `C:\Claude\eCommerce\V6 Veeey_editable_featues_v2.docx`, findings S1–S15 on `/admin/analytics/sales`;
  9 commits `8f79d3e` → `9141676`, deployed same day). **S6 + S9 were already fixed by V5 — V6 was audited
  against a pre-V5 build**, so triage-first mattered. What shipped, and the five bugs found that the audit
  itself missed:
  - **S1/S14 `8f79d3e`** — new `date-range-controls.tsx` client half of the shared range control: editing a
    date flips the mode to Custom (S1), picking a preset clears the dates AND drops their `name` so they're
    never submitted (S14). The missed bug: since the resolver lets explicit bounds win (V5 F10), stale dates
    kept winning — **choosing "Last 7 days" silently did nothing**. Dashboard + Report builder inherit the fix.
  - **S3 `67e4662`** — `periodRange` rewritten to ONE documented algorithm (whole calendar month → prior
    calendar month; MTD → same elapsed span of the prior month, day-clamped; else equal-length preceding
    window; all joins half-open, `prevEnd < start`). Missed bugs: **MTD on a 31st ran "previous" 3 days INTO
    the current window** (same orders on both sides of every delta), and rolling presets set
    `prevEnd === start`, double-counting the boundary order under `gte/lte`.
  - **S4 `1115804`** — the 417-vs-511 gap explained on screen: `NON_BOOKED_STATUSES` moved to
    `sales-analytics-core` and shared with `order-service`, new **`/admin/orders?status=booked`** pseudo-filter
    reproduces the exact number, every panel names its basis, the lifetime card admits it ignores the range,
    and a disclosure lists the excluded statuses with a one-click reconcile link.
  - **S5/S7/S8 `5ae6cb4`** — BarChart: labels wrap (no `truncate` clipping "5000+"), min-w-0 everywhere so
    flex/grid can't push the page sideways, tooltip renders inside the plot + edge-flips, and every bar shows
    its value (compact) without hover; exact figures stay in tooltip/aria/sr-table.
  - **S2/S12 `1cc1210`** — "No orders in this period" empty state (names the previous period's count);
    panels suspend behind a skeleton keyed by the range; new `salesPeriodRange` labels the window without
    the DB so the filter paints immediately.
  - **S13 `7c84ddd`** — per-panel CSV (new `sales` report on the export route — which had to re-resolve with
    Sales' mtd default; the route's 30d default would have exported a different window than shown, the exact
    V5 F20 defect again) + drill-through: metric rows link to Orders under the same window/basis; Orders grew
    `minTotal`/`maxTotal` (EGP, min-inclusive/max-exclusive = the big/normal split) with labelled chips.
    `sales-links.ts` holds the tested URL contract. **New-vs-repeat deliberately has NO link**: Sales' "repeat"
    (ordered before period) ≠ Customers' `repeat` segment (≥2 ever) — linking them recreates the S4 confusion.
  - **S10 `f56cd30`+`4738b27` (PROVISIONAL)** — ⚠️ the doc's "(see Improvements)" section **does not exist**;
    owner chose interim scope (trend + top sellers) "till I give you more details" — revisit on spec.
    Trend: traffic-chart generalized to **`time-series-chart.tsx`** (primary/secondary + per-series units; F3
    normalization is what makes piastres vs counts plottable) — dashboard re-uses it unchanged; trend bucketed
    from the SAME rows the cards count (no 2nd query, can't disagree), grain day→week→month, quiet buckets
    emit zeros. Top products/brands by line-item revenue (raw SQL, `qty × unitPrice`, lost-lines excluded;
    panels state that line revenue ≠ order-total revenue — shipping/discounts). Products link to Orders via new
    `productId` filter; **brands link to catalogue** (an order can span brands). Missed bug: **FilterBar dropped
    undeclared params on submit** — a drill-through's filters silently vanished while the header still said
    "filtered"; it now carries them (`keep` prop) → likely shrinks V7 C18.
  - **S11/S15 `9141676`** — deltas use the shared `kpi-trend` helper (missed bugs: zero delta rendered as
    green ▲ because the check was `>=`; no-baseline segments showed a ÷0 percentage — now "new") + sr-only
    direction words. S15: **admin pages served GA4/GTM + PostHog + Clarity** — Clarity was recording order
    screens (customer PII) to Microsoft. New tested `isAdminPath` + `StorefrontOnly` gate the three loaders;
    `AnalyticsProvider` stays mounted but mutes on admin (no clickstream pollution, no dataLayer pushes — after
    a storefront→admin SPA nav GTM is live, so a push WOULD have hit GA4).
- **V5 audit doc FULLY shipped (P0+P1+P2+P3) 2026-07-17** (source: `C:\Claude\eCommerce\V5 Veeey_editable_featues_v1.docx`;
  commits `8f78383` search-500+token-blocklist → `5a295cb` dashboard D-01..05 → `84211ba` analytics F2-F6/F10/F12
  → `79c5d56` P2 batch D-06..D-11 + F8/F9/F11/F13/F14/F18 → `dc1cd22` P3 batch D-12..D-17 + F15-F17/F19/F20).
  P3 highlights: **F19 real bug** — the shared range's `mtd` used integer `ceil(elapsed)` days ending at *now*, so
  the window leaked hours of the previous month and disagreed with Sales for the same preset; now exact
  month-start→now (fractional `days` + pinned `endAt`; `visitorTimeSeries` ceils for its daily series) + an explicit
  revenue-basis note on Sales (bookings vs delivered). **F20** — the CSV export route honored only `[7,30,90]`
  `?days=`, silently exporting a different window than a custom range showed; it now takes the full
  preset/from/to contract, and filenames carry the window via `rangeTag()` (custom reports also carry
  metric/dimension/filter). F16 report builder merged bar+value into one metric column; F17 breadcrumb grew a
  named sub-crumb (Admin › Analytics › Report builder, `SUB_CRUMBS` in admin-shell); F15 sales histograms one
  palette; D-13 KPI delta line shows the direction word; D-14 collapsed-sidebar aria-labels; D-15/16 tile/card
  height+label alignment; D-17 breadcrumb root is a real link (+ RTL chevron flips).
  Root causes worth remembering: search analytics raw SQL said `o."createdAt"` but Order's field is **placedAt**;
  the traffic chart used `hsl(var(--primary))` against **hex** tokens (invalid CSS → invisible series/dark chart).
  P2 highlights: **`src/lib/analytics-range.ts`** is now the ONE date-range contract
  (`?preset=mtd|7d|30d|90d|custom&from&to`, legacy `?days=` honored, inverted bounds auto-swapped) shared by the
  analytics dashboard, Sales and the Report builder (+ CSV export) via `<AnalyticsDateRange>`; custom windows are
  **both-ends-bounded** all the way into the report SQL. Crawler-referrer blocklist (semrush/ahrefs/…) ORed into
  `isBot` at ingest (F8). Product-performance table is sortable + show-all-50 (F14). Dashboard expiry list got a
  severity legend + per-lot deep links (D-06); BarChart has per-bar aria-labels + sr-only table (D-11); D-10 was
  verified already clean. **Nothing remains from the V5 doc except the owner's open product questions**
  (funnel attribution intent, geo-enrichment mmdb, UTM wiring, fulfillment location, SSO-vs-OTP);
  F18's real fix is the owner dropping a GeoLite2 mmdb at `GEOIP_DB_PATH` on prod.
- 🔸 **THIS CODEBASE NOW RUNS TWO INDEPENDENT STORES.** Besides veeey.com, a **second, separate
  store is live at veeey.net** (own DB/customers/orders, **not synced** with veeey.com) — deployed
  2026-07-15, co-hosted on the CyberPanel/OpenLiteSpeed box that also runs the egyptvitamins.net
  WordPress copy. **It is wired differently** (app at `/opt/veeey`, pm2 `veeey-net`, OLS proxy,
  tarball deploys, and it **must run `server.js` not `next start`** — see the Origin bug).
  **Read `DEPLOYMENT.md` → "Second deployment — veeey.net" before touching it.** Its catalog is
  still empty; the import plan is `../VEEEY_NET_MIGRATION.md`.
- **Full-system UI/UX + bug review done (3 audit passes, 2026-07-13/14).** `e822e60` (self-audit,
  committed cross-account): buy-box **lot pinning** so the chosen expiry/price lot is the one charged
  (FR-INV-02), refill sweep **at-most-once CAS** + atomic finalize + default-shipping address, login
  `?next=` open-redirect guard + locale-aware sign-out, server-side feature-gates on wishlist/compare/
  alerts/special-order actions, variant unlink `Prisma.DbNull`, AR string fixes. Then the LOW pass
  (`3faf136`) + admin/i18n/RTL pass (`cd1b6f8`): RTL breadcrumb & CTA/nav-drawer icon flips, real
  Select-tier teaser price (no hard-coded 8%), full rating-histogram from groupBy, redeem stepper =
  configured rate, special-order phone field when the account has none, gift bilingual customer name
  (`gift_customer_name` migration), search-CTR unique-slug ranking, **provider "clear config" redirect
  typo** (OPay/Kashier/Aramex pointed at the next provider), two missing `audit()` calls, a11y aria
  labels. Audit verified admin RBAC/audit coverage, redirect-in-try, storefront RTL classes CLEAN.
- **Refill module is now FULLY BUILT (epic #119, `05b706f`+`cd8f366`) but still switched OFF on prod** —
  the feature toggle at `/admin/features` is off (owner choice), so `/refill` redirects home and the sweep
  no-ops. **To launch Refill: (1) `/admin/features` → Refill ON; (2) Settings › Refill → `refill.enabled=true`**
  (shows the buy-box subscribe option); optionally tune `refill.discountPercent` (15) / `refill.noticeDays` (3) /
  `refill.frequencies` (30,45,60,90). How it works: customer picks "Subscribe with Refill" + a frequency on the
  PDP → first COD order places immediately → the worker (daily 07:00 UTC) SMSes an advance notice then
  auto-places each cycle as COD via FEFO allocation with the Refill discount; out-of-stock cycles are skipped
  with an SMS; every SMS carries a login-free manage link (`/refill/manage/<token>`); customers also manage
  plans (frequency/skip/pause/cancel) from their account page; staff oversee at **`/admin/refill`**.
- **Product variants shipped** (audit P1 §5.4, `e0e2fbd`+`31df542`, migration `product_variants`):
  sibling products linked into **variant groups** with structured axes (Size / Flavor…) — PDP shows chip
  selectors linking between siblings (each keeps its SKU/lots/URL), and **reviews + rating aggregate across
  the family**. Admin: **`/admin/variant-groups`** (name, up to 3 bilingual axes, members with one EN/AR
  value per axis; row order = chip order). Cart/orders/inventory/WooCommerce sync untouched by design.
- **Bulk attribute editor** (`5660d9d`, no migration): `/admin/attributes/bulk` (catalog.write) — pick an attribute,
  filter products (category/brand/search/only-missing), multi-select, assign one value to all (SINGLE_SELECT replaces,
  MULTI_SELECT adds); optional **Suggest with AI** proposes a value per product (`ai.ts`, Anthropic, constrained to the
  allowed values, degrades to null when AI off) for review. Speeds up filling attributes so the PLP filter sidebar has values.
- **One-click attribute auto-fill** (`d544caa`, no migration): "Start auto-fill" on the bulk page runs a worker job
  (`attributeAutofill`, brand-translate pattern: 4h visibility, no retry) that AI-tags every product missing a value for
  every filterable attribute — only-missing (never overwrites staff-set values), constrained to allowed values; AI-declined
  products are skipped. Progress in Setting `attributes.autofillJob`, shown on the page with per-attribute missing counts.
  Needs the Anthropic key in Providers. ⚠️ Code lesson: `Product` has NO `archivedAt` — filter with `status != ARCHIVED`
  (an untyped where hid this from tsc and briefly shipped a crash in `productsForBulk`; fixed in `d544caa`).
- **Trustpilot reviews widget** (`5660d9d`, no migration): `/admin/trustpilot` (settings.manage) — Business Unit ID + domain +
  locale + theme, per-placement toggles/templates for homepage, footer, checkout. TrustBox loader mirrors the Google-tag
  pattern. Settings-backed JSON (`trustpilot.config`); **inert until the owner pastes a Business Unit ID** (create a Trustpilot
  Business account → Integrations → TrustBox). **Refill is currently toggled OFF on prod** via /admin/features (owner choice —
  `/refill` redirects home by design; see the feature-flags section).
- **Feature toggles** (`be72aaf`): **`/admin/features`** (settings.manage + audit) switches 15 customer-facing
  features on/off — Refill, Veeey Select, special orders, Learn/Blog, quizzes, compare, wishlist, pre-order,
  buy-again, reviews, Q&A, loyalty points, gift-with-purchase, stock alerts, social login. **OFF hides the
  feature everywhere** (header nav, footer, home, product pages, login) **and redirects its route(s) to the
  homepage.** Settings-backed (`feature.<id>`), no migration; everything defaults ON. Registry +
  route-guard/link-filter helpers in `feature-flags.ts` (unit-tested) + `feature-service.ts`.
- **Search analytics + fuzzy suite** (`be72aaf`, migration `search_suite`): every storefront search + result
  click is logged; `searchProducts` expands synonyms + Arabic-normalized terms and does a pg_trgm fuzzy
  top-up (typos still match); "did you mean?" on low-result pages; trending searches feed the autocomplete
  empty state. Admin: **`/admin/analytics/search`** (KPIs, search→click→sale funnel, top/zero-result/
  purchase-driving terms), **`/admin/search-synonyms`** (bidirectional alias CRUD), **`/admin/search-demand`**
  (clicked-but-out-of-stock restock list + zero-result demand). Weekly search-digest email cron (Mon 06:30 UTC,
  gated by Setting `search.weeklyDigest`, needs SMTP). Verified live: fuzzy typo search 200, query logging OK.
- **Orders list revamp** (`6d7e3e7`): handler shown as photo-avatar (initials fallback, name on hover);
  payment + channel shown as icons (name on hover); Customer column shows the name not email; Date moved
  first; Total is number-only (no EGP); "Open" button removed — order #, total, and item count all link to
  the order. (`order-cell-icons.tsx`.)
- **Special-order form** revamped (`7e58399`): logged-in shoppers skip name/phone (filled from account),
  new Size + Concentration fields, optional customer photo upload (`/api/special-order/upload`, rate-limited),
  phone validation (Egyptian 01…/international, pure `phone.ts`), Notes→Details. **Seed products deleted**:
  the 6 non-`legacyWpId` sample products removed on prod — catalog is now 2,548, all Egypt Vitamins–synced.
  **Error system** (`e26e356`): branded 404/500/global-error pages + optional `ErrorLog` (Setting
  `errorLog.enabled`, admin viewer at `/admin/error-log`, logs 404s + runtime errors, best-effort).
- **Dashboard quick cards now configurable** (`dashboard.quickCardCount`, 3–10, one/two rows). **New
  `/admin/analytics/sales`** (`b9a7f54`): period presets (MTD default) + auto compare-to-previous;
  Orders/AOV/Revenue for This-vs-Previous, New-vs-Repeat customers, Big-vs-Normal orders
  (`analytics.bigOrderEgp`); order-value + customer-lifetime distribution histograms; interactive
  responsive hover bar charts (`sales-analytics-core` pure + tested). (The "Part C" search suite
  that was TODO here **shipped** — see the search analytics bullet above.)
- **PDP short description moved** (`61ef860`, 2026-07-13): the key-selling-points block now renders
  INSIDE the buy box directly under the "Choose your expiry & price" selector (was below Add to Cart) —
  owner screenshot request. New optional `shortHtml` prop on `ChewyBuyBox`; sanitized server-side as before.
- **V4 + V5 docs fully delivered** (segment filters `fc72d4f`; thresholds `customers.highValueEgp`/`lapsedDays`).
  **Loyalty points are now staff-manageable** (`ea8df48`): customer profile has add/deduct (signed ADJUST,
  never below 0) + ledger + per-customer "credit past orders"; `/admin/tiers` has a global retroactive
  backfill (background `loyalty-backfill` job, points-only, idempotent) — this **reverses the earlier
  "no retroactive points" decision** at the owner's request. Remaining owner spec-change: verification =
  email-OR-phone at checkout (not signup double-opt-in). YeldnIN intake stays prep-behind-`INTEGRATION_ENABLED`.
- Storefront chrome is admin-editable: **announcement bar show/hide + bilingual text** on
  `/admin/homepage`; **menu-bar font family + base/per-item size + colour** on `/admin/navigation`;
  **logos/favicon/titles** on `/admin/branding` (favicon is now authoritative — the default
  favicon.ico moved to /public so it no longer competes). Runtime uploads serve via the
  `/uploads/[...path]` route handler (see Code lessons).
- Stack: Next.js 16 (App Router, Turbopack) · TypeScript strict · Prisma 7 + Postgres ·
  Auth.js · next-intl (AR/EN, RTL) · Tailwind v4 · pg-boss v12.

### Shipped 2026-07-11 → 2026-07-12 (newest first)

| Feature | Commits | Notes |
|---|---|---|
| **Product-photo watermarking (reversible)** | `0cec768` `5231af6` | `/admin/watermark` (Appearance, catalog.write): stamp the brand logo onto product photos with a **live preview** (logo choice / 3×3 position / size / opacity / margin) + auto-stamp-new-uploads toggle. **Non-destructive** — stamped copy is `<name>__wm.webp`, `ProductImage.originalUrl` keeps the source; re-stamp composites from the original, "Remove watermark" restores it. Batch over all / category / brand / collection (primary-only + skip-stamped) runs in a `watermark` pg-boss job. Pure `watermark.ts` tested. Migration `watermark`. Default stamp logo = the icon-only branding mark. |
| **Branding: icon-only logo slot** | `575d188` | Added a 3rd logo slot (icon-only square mark) beside horizontal + transparent-header; used on the compact/mobile header, as the PWA app icon, and as the default watermark logo. `branding.logoIconUrl`. |
| **Announcement bar toggle + favicon authority** | `e3c634b` | `/admin/homepage` gains a show/hide + bilingual-text Announcement bar card (layout honours `home.announcementEnabled`). favicon.ico moved to /public so the uploaded favicon is the single authoritative icon link. |
| **Google Search Console API + sitemap (Task 2)** | `c404952` | Sitemap now includes brand + collection detail pages + `/brands`,`/collections` indexes (categories excluded — filter-only). New `/admin/google/search-console`: OAuth Connect Google (offline→refresh token, signed-state CSRF callback), **auto-submit sitemap** (button + daily 05:15 UTC `gsc-sitemap` cron), sitemap status (submitted/indexed/errors), URL Inspection (verdict/coverage), 28-day search performance (totals + top-25 queries). **Inert until owner adds an OAuth client** (Google Cloud → enable Search Console API → Web OAuth client → redirect URI `https://veeey.com/api/admin/google/gsc/callback` → paste client id/secret on the page → Connect). Pure `gsc-config` tested. |
| **Providers status table + admin RBAC + language button** | `ef4a900` `c914e0a` `021962d` | Providers page: top provider-status table (configured/verified badges + jump links) + per-section save banners + persisted check results + WhatsApp/AI checks. RBAC: grouped 22-privilege matrix (bilingual, select-all) + **admin role now full-trust `*`** (prod admin granted rbac.manage — takes effect at their next sign-in). Visible globe language-switch button in the admin header. |
| **Dashboard personal quick cards** | `292944a` `32848fb` | Dashboard opens with 8 cards linking to THAT user's most-visited admin sections. AdminShell records visits (fire-and-forget `recordAdminVisitAction` → `AdminSectionUsage` upsert, dashboard excluded); dashboard resolves top hrefs → sidebar labels/icons, permission-filtered, topped up with defaults until history accumulates. NAV_SECTIONS extracted to shared `src/lib/admin-nav.ts` (layout + tracker + dashboard read one source). Migration `admin_usage` (48th). Also `021962d`: visible globe language-switch button in the admin header. |
| **Provider "Check connection" buttons** | `9c9e344` | `/admin/providers`: live checks for **OPay** (creates a 1-EGP throwaway cashier session → validates merchantId+public key on the real checkout endpoint, then status-queries it → validates the webhook's HMAC private key), **Kashier** (order-inquiry with the payment API key; 404 = key accepted, 401/403 = rejected), **Aramex** (minimal rate calc; ClientInfo notifications = auth failure), **SMSA** (dummy-AWB tracking via REST API-key or legacy SOAP passkey). Results: ok / failed / inconclusive / not-configured + raw provider code, bilingual, audit-logged (`provider.check`), 12s timeouts, zero mutations. |
| **Arabic SMS fix (UCS-2 HEX)** | `b70d2e2` | SMSMisr language 3 alone wasn't enough — Unicode message bodies must be **UCS-2 HEX** (4-digit uppercase UTF-16 code units, pure `sms-encoding.ts`, tested incl. surrogate pairs) or SMSMisr answers 1909 even with the right language. GSM/English messages unchanged. |
| **V5 Customers stream (F30–F37)** | `1602bb7`→`8459842` | **F30 checkout verification** ("verify email or phone to checkout", owner decision): 6-digit OTP via SMSMisr SMS or email (generalized `otp-service` `requestVerifyCode`/`verifyCode`, hashed + rate-limited); guests get a 24h signed HMAC cookie (`verify-cookie.ts`), signed-in shoppers get `User.phoneVerified`/`emailVerified` persisted and skip future checks; `placeOrder` enforces server-side; **admin toggle Settings › Checkout "Require verified contact to checkout" — shipped OFF; owner flips to `true` after one live OTP checkout test on their phone**; gate auto-disables when neither SMS nor SMTP can deliver (never bricks checkout). **F31 standing**: `Customer.status` ACTIVE/FLAGGED/BLOCKED (BLOCKED can't order) + derived "Unverified" badge; status filter + bulk Set-status; **"Scan for suspicious" button** flags disposable-email / nameless+unverified+orderless / stale-90d-unverified / 10-per-hour signup bursts, appends reasons to internal notes (pure `customer-spam.ts`, tested). **F32 cleanup** via Flagged/Unverified filters + existing no-orders-only bulk delete. **F33** sortable Orders + Last-order columns, has/no-orders segment. **F34** nameless rows show email handle/phone (was literal "Profile"). **F35** email+SMS marketing consent flags + staff-only notes on detail page (Standing & marketing card w/ verification dates). **F36** customers CSV export needs `customers.write`; ALL exports audit-logged w/ row counts. **F37** reCAPTCHA wiring completed (`RecaptchaToken` fills the previously-always-empty token via grecaptcha v3 when `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` env is set; fail-open on misconfig). Migration `customer_v5`. |
| **Branding admin (favicon/logos/titles)** | `a85dd8b` | `/admin/branding` (Appearance group, `settings.manage`): site name EN/AR (logo alt + JSON-LD Organization/WebSite name + PWA manifest), browser-tab default title EN/AR (root `generateMetadata`; per-page SEO titles still override), main + light logo uploads (header knockout slot, mobile menu, footer; empty = built-in artwork), favicon upload (auto-converted to universal 64px PNG via `toFaviconPng`; upload route `kind=icon` gated `settings.manage`). Settings keys `branding.*` (pure `branding.ts` parse, tested). No migration. |
| **SMSMisr SMS provider LIVE** | `64d5e1b` `4a1bd43` `06e4eb0` | Owner's creds sorted (the three values are: API username `b2e00aad…`, API password (regenerated), **sender token** `3e876255…` — the sender field takes the TOKEN, not the display name "Yeldn EGV"). Test banner now surfaces the exact `sms_<code>` + bilingual fix hint (1903 creds / 1904 sender / 1906 credit …). **Auto-Unicode**: non-ASCII messages (Arabic, em dashes) switch to SMSMisr language 3 — English test AND Arabic test both received on the owner's phone. Order SMS (placed/shipped/delivered) now delivers; **phone-OTP login + F30 checkout OTP ride this gateway**. |
| **V4 Shipping stream (E23–E28)** | `9f00b1c`→`cb08885` | **"Free shipping over EGP 1,500" concept removed** (cart-drawer progress bar deleted; nav default promo disabled+empty; prod had no `nav.config` override so the header line is gone live). **UltraFast only in Greater Cairo + Giza** (checkout hides it elsewhere w/ graceful fallback). Structured ETA `etaMinDays/etaMaxDays` (+optional label) renders bilingual "2–3 business days". Zones/sub-areas bilingual (`nameAr`). Admin: collapsed zone accordion + search, delete confirmations, sub-area **Save-all**. **Seed RAN on prod**: 27 zones AR names + **194 sub-areas created** (`scripts/seed-shipping-areas.ts`, idempotent, dry-run default). Migration `shipping_v2`. Flat per-method fees kept by design. |
| **V4 Stocktake stream (D15–D22)** | `f3d34a4` `cefbce0` | **Behavior change: counting only RECORDS — stock changes when a reviewer "Approve & apply"s the reconcile screen** (lot-level adjustments + ledger `refType stocktake` + audit; "Close & discard" keeps counts, changes nothing). New count sheet: live color-coded variance, search/filters/pagination, Save-all batch + progress bar, barcode SKU+Enter → +1, blind-count mode, condition badges. Sessions: scope (category/brand cycle counts), assigned counter, created/approved-by attribution, variance + adjustment summaries, delete for never-applied. Recurring `StocktakeSchedule` auto-opens sessions (daily 02:45 UTC cron, new `stocktake-cycle` queue). Migration `stocktake_v2`. |
| **V4 Inventory stream (C7–C14)** | `535da20`→`163134f` | Searchable `ProductSelect` picker fixes lot-edit preselect (old dropdown capped at 200 rows) + intake; expiring/condition filters + status colors + dashboard deep-link; lots BulkBar (−% discount / status / CSV export via new `lots` adapter) + Reserved column; `Product.reorderPoint` (migration `reorder_point`) feeds the To-buy short-stock tab + product-form field; **condition-migration tool** `/admin/inventory/condition-migration` (dry-run → gated apply: "{Broken bottle}"-named variants' lots move to base product w/ condition, variant archived); YeldnIN receiving preps QUARANTINE intake lots w/ supplier cost behind `INTEGRATION_ENABLED` (⚠️ `unitCostEgp` contract field to confirm at re-baseline); cost editable at intake publish; killed a dormant `loc_main` hardcode in mock intake. |
| **Gift-with-purchase automation** | `1197db5` `c213f55` | `GiftRule` model + pure engine (`gift-rules.ts`) + `applyGiftRules` inside checkout/staff-order tx (atomic gift-stock claim, skip-not-fail); cart earned/nudge hints; confirmation gift lines; admin `/admin/gifts/rules` (create/pause/delete, product-by-SKU + category + subtotal + window conditions). Migration `gift_rules`. |
| **Urgent bugs: expired lots + loyalty (V4 C6 / V5 F29)** | `15fb27b` `e467731` | LIVE lots past expiry auto-flip to EXPIRED (daily 03:10 UTC cron + reserveStock guard + "Expired stock" section on `/admin/inventory/expiry`); backfill expired 1 overdue lot. Loyalty standing (lifetime spend + tier) recomputed canonically from DELIVERED orders — root cause: wc-synced orders never pass transitionOrder; `Tier.minSpendPiastres` (migration, editable in /admin/tiers; ⚠️ starter thresholds VIP 20k / Select 50k EGP — owner to confirm); daily 03:25 UTC cron + after credit/reverse; **backfill updated 6,557/16,213 customers → 15,504 Green / 442 VeeyIP / 267 Select. NO retroactive points (owner decision).** |
| **Wishlist price-drop alerts (FR-WSH-02/03)** | `3a948d6` `33d8b4c` | PRICE_DROP events now fire on base-price drops (admin edit / bulk tool / AI apply); exactly-once fan-out via `ProductChangeEvent.processedAt` (historical rows pre-stamped); EMAIL (AR/EN, localized deep link, needs SMTP, Setting `alerts.wishlistEmailEnabled`) + PUSH; per-sweep dedupe; pure helpers in `alert-plan.ts`. |
| **Bugfix: inventory tab links** | `ed204ab` | Requests/Expiry tab links double-prefixed the locale (`/en/en/…` → 404). Root cause + rule in "Code lessons" below. |
| **Portability + hardening pass** | `62f6bef` | Real README (fresh-clone setup), `SECURITY.md` (secret/PII policy + npm-audit triage), `.nvmrc` (Node 22), completed `.env.example` (added `GEOIP_DB_PATH`, `SHADOW_DATABASE_URL`, real Apple keys); patched dompurify 3.4.10→3.4.11 (only safely-fixable advisory). |
| **Localized email deep links** | `a02d89c` | Review-request + abandoned-cart emails now use `Customer.locale` for both the link path (`/{locale}/…`) and template locale. |
| **4 growth features (#185–188)** | `529a8a6` `55d5f00` `8931264` `948c8e9` | **Buy-again** (account order history → re-add past order's in-stock lines, gifts/OOS skipped). **Zero-result search fixer** `/admin/search-rules` (rewrite a query or redirect it; lists analytics zero-result queries with one-click fixes; storefront search consults `matchSearchRule` first; migration `search_rules`). **Post-delivery review requests** (DELIVERED → delayed pg-boss email for un-reviewed products, `Order.reviewRequestSentAt` dedupe; migration `review_request`; Settings › Reviews). **Abandoned-cart recovery** `/admin/abandoned-carts` (one `CartSnapshot` per signed-in customer, hourly sweep emails one reminder after `cart.abandonedIdleHours`; migration `cart_snapshot`; Settings › Cart). ⚠️ **Both email features need SMTP configured to actually send.** ⚠️ Cart is cookie-based → **guest carts can't be captured/emailed**. |
| **Inventory epic: To-buy + Expiry Fight** | `8a6bd80` `2bcd6be` `ea5ff2e` `b89ab4f` `2271e71` | **Requests / To-buy** `/admin/inventory/requests` — tabs: out-of-stock · last-pieces · short-stock (featured→180d window, else 90d) · running-fast (last-7d ≥3× prior-6-week avg OR last-30d ≥3× prior-6-month avg) · special-orders (open pre-orders) · Ignored; rows show 30/90/180-day units, sellable stock, incoming (YeldnIN, later), requested, pre-orders; per-row + bulk **Request** (→ local `PurchaseRequest`, queued to YeldnIN outbox — no-ops while integration disabled) and **Ignore** (30-day snooze, lifts if stock rises). **Expiry Fight / To-sell** `/admin/inventory/expiry` — 5 windows (this/next calendar month + rolling 90/180/365d, cumulative, by soonest lot); rows show the 3 nearest-expiry lots (expiry/stock/price) + 30/90/180-day sales; **per-lot quick markdown** reuses `setLotPrice` (per-expiry price + saleFlag + SALE_LOT event + audit). Pure engine `src/lib/inventory-reorder.ts` (29 tests). **Featured = Best Sellers collection** via Setting `inventory.featuredCollectionSlug` (owner decision). Migration `inventory_reorder` (`PurchaseRequest` + `ReorderIgnore`). Permission: `inventory.manage`. |
| **Blog/CMS breadcrumbs + BlogPosting** | `a78ecf3` | Blog posts got `generateMetadata` (Google was inventing titles) + BlogPosting + BreadcrumbList JSON-LD; CMS pages got BreadcrumbList. **Every storefront page type now emits BreadcrumbList.** No migration. |
| **Analytics epic finale (P6 + DSAR)** | `3044751` | `/admin/analytics/report` builder (allow-listed metric × dimension × range × filter, URL = saved view, CSV) + **DSAR erase** action on customer detail (Privacy & data section). Epic P1–P6 complete. |
| **Privacy policy tracking disclosure** | (DB content) | Bilingual Analytics/Cookies/Tracking section inserted into the live `/p/privacy-policy` CMS page (direct DB update; prior bodies backed up in AuditLog rows `cmrevyv6b000073g7t37pc99n` + `cmrew259f0000efg776u40jag`). Owner: lawyer review + fill company name/address (§7). |

### Earlier this cycle (2026-07-10)

- **Visitor analytics epic P1–P5** (`0016a47`→`88e41c6`, migration `analytics_enrichment`):
  consent-tiered IP/geo/device/dwell capture + retention cron; commerce-joined metrics
  (`analytics-insights.ts`); `/admin/analytics` dashboard (7/30/90 filter, SVG chart, CSV export);
  client GA4 dataLayer bridge (`datalayer.ts`); server-side GA4 Measurement Protocol
  (`ga4-mp.ts`, Next `after()`, `google.ga4ApiSecret`). **Inert until owner adds GA4/GTM ids +
  MP secret in `/admin/google`; geo null until a GeoLite2-City.mmdb sits at `GEOIP_DB_PATH`.**
- **SEO search-appearance** (`c905ec5` + follow-ups): homepage title/desc admin-editable
  (`seo.homeTitle/Desc En/Ar` in Settings), sitewide Organization+WebSite(SearchAction) JSON-LD,
  BreadcrumbList on PDP/category/brand/collection. **Owner: Search Console verify + submit
  sitemap + request-index the homepage.**
- **Media localization ran on prod**: all 12,483 old-CDN images → WebP in `/uploads`
  (remoteMedia = 0); 0 published products missing an image (14 private, 3 real ones need photos).
- pg-boss job-expiry fix (`e3138c0`); rule-engine `contains` operator (`52531e5`).

---

## Continuing from another account on this device

Assistant memory is **per-Windows-user** (`C:\Users\<user>\.claude\projects\C--Claude-eCommerce\memory\`)
and will NOT be present under a new account. **This doc + the repo docs are the complete,
portable source of truth** — everything below is what the memory contained that matters.

1. **Working copy**: `C:\Claude\eCommerce\veeey` is on a shared path — reuse it as-is.
   The **`.env` file there is gitignored and NOT recoverable from git** — do not delete it.
   (A fresh clone elsewhere works too: follow `README.md` → copy `.env.example`, or copy the
   existing `.env` across.)
2. **Deploy (SSH) access is per-user** — the `ssh veeey` alias lives in the old account's
   `~/.ssh`. To restore it under the new account:
   ```
   ssh-keygen -t ed25519            # accept defaults
   # Add the new ~/.ssh/id_ed25519.pub to /root/.ssh/authorized_keys on the server
   # (via an existing session, the CWP web terminal, or the hosting console).
   ```
   Then create `~/.ssh/config`:
   ```
   Host veeey
     HostName 204.168.129.186
     User root
     IdentityFile ~/.ssh/id_ed25519
   ```
   Test read-only first: `ssh veeey 'cd /home/veeey/app && git log --oneline -1'`.
   **The veeey.net box is separate**: alias `evnew` (root@178.105.234.110) lives in the old
   account's `~/.ssh_ev/config` with key `~/.ssh_ev/id_rsa` — recreate the same way (own key →
   that box's `/root/.ssh/authorized_keys`, config `Host evnew` in `~/.ssh_ev/config`, used as
   `ssh -F ~/.ssh_ev/config evnew`). Runbook: `DEPLOYMENT.md` → "Second deployment — veeey.net".
3. **GitHub**: repo `aleimam/veeey`, branch `master`. The new account needs its own git
   credentials (`gh auth login` or a PAT) to push.
4. **Node**: 22 (`.nvmrc`); `npm install` regenerates the Prisma client via `postinstall`.
5. **Workflow rules** (unchanged, see `AGENTS.md`): discuss big features before building; build
   phase-by-phase; run the verify gate before every commit
   (`npm run typecheck && npm run lint && npm run test && npm run build`); one feature per
   commit; migrations in their own commit; bilingual EN/AR everything; RBAC-gate + audit every
   admin write; update this doc after each epic.

## Deploy & server access

- Server: `root@204.168.129.186` (alias `veeey`), app at `/home/veeey/app`, Postgres `veeey` @
  localhost:5432, pm2: `veeey` (web) + `veeey-worker` (jobs) + `yeldnin`. Host runs CWP.
- **Full deploy recipe** (idempotent — required whenever migrations or dependencies changed):
  ```bash
  cd /home/veeey/app && git checkout -- package-lock.json && git pull \
    && npm install && npx prisma migrate deploy && npm run build && pm2 reload veeey
  ```
  Add **`pm2 reload veeey-worker`** whenever worker/queue/cron/notification code changed.
  Code-only changes can skip `npm install`/`migrate deploy` — but see gotcha #1.
- Verify after deploy: `git rev-parse --short HEAD` moved; `npx prisma migrate status` = up to
  date; `https://veeey.com/api/health` = ok.

### Deploy gotchas (each of these caused a real incident)

1. **Always `git checkout -- package-lock.json` before `git pull`.** `npm install` on the server
   dirties the lockfile; a plain `git pull --ff-only` then **silently fails to advance HEAD**
   while a chained `&& build && reload` happily redeploys the OLD code — it *looks* deployed but
   isn't. Always confirm `git rev-parse --short HEAD` equals what you pushed.
2. **Regenerate the Prisma client when the schema changed.** The lightweight
   `pull → build → reload` path leaves `src/generated/prisma` stale → runtime errors on new
   models. Use the full recipe (its `npm install` runs `prisma generate`).
3. **NEVER edit a deployed migration — always add a NEW idempotent one.** Rewriting one in place
   took veeey.com down on 2026-06-27. Hand-write `ADD COLUMN IF NOT EXISTS` /
   `CREATE TABLE IF NOT EXISTS` / guarded FKs (see any recent migration for the pattern).
4. **Rapid back-to-back SSH connections can trip a ~35-minute port-22 firewall ban** (CSF).
   The site stays up on 443; just wait it out. Space deploys out; batch server commands into
   one ssh call.
5. **Ad-hoc prod DB queries**: the server's psql role is awkward — use
   `cd /home/veeey/app && npx tsx -e "import 'dotenv/config'; …PrismaClient…"` instead
   (the `dotenv/config` import is required; `tsx -e` does not auto-load `.env`).
6. `curl localhost:3000` on the server returns 000 (app isn't bound there) — verify via
   `https://veeey.com/api/health`. A brief 502 right after `pm2 reload` is a normal
   graceful-reload blip. The worker's pm2 `restarts` counter is cumulative/benign — check
   `unstable restarts` and the error log instead.

## Code lessons (hard-won — follow these)

- **Runtime uploads don't serve from `public/` under `next start`.** `next start` only serves
  `public/` files that existed **at build time**, so admin-uploaded media (branding logos,
  favicon, product images) 404 until the next build even though the file is on disk. Fixed by
  serving `/uploads/*` through a route handler (`src/app/uploads/[...path]/route.ts`) that reads
  from `public/uploads` at request time (build-time files still served by the static layer first).
  Do NOT rely on static public serving for anything written after build (`e28b5ba`).
- **next-intl `<Link>` (from `@/i18n/navigation`) prepends the locale itself.** Pass it
  locale-RELATIVE hrefs (`/admin/...`). Passing `/${locale}/admin/...` produces `/en/en/...`
  → 404 (this shipped as a real bug, fixed in `ed204ab`). By contrast, `redirect()` from
  `next/navigation` and plain `<a>` tags (e.g. `ListPagination`) DO need the `/${locale}` prefix.
  `redirect` from `@/i18n/navigation` takes `{ href, locale }`.
- **Keep pure helpers in import-clean modules.** A vitest file that imports anything which
  imports `auth-guards` drags next-auth in and the suite fails
  (`Cannot find module next/server`). Pattern: pure logic in its own file
  (e.g. `search-normalize.ts`, `inventory-reorder.ts`), the DB/RBAC service imports it.
- **`react-hooks/purity` lint bans `Date.now()` in server components** — compute times/ages in
  the service layer and pass them down (also applies to `useRef(Date.now())` in client
  components — stamp in an effect instead).
- **pg-boss v12**: named export `{ PgBoss }`; `createQueue()` must run before `work()/send()`;
  use `expireInSeconds` (not hours) — long jobs need it raised or they get re-dispatched after
  the 15-min default; delayed jobs via `boss.send(queue, data, { startAfter: seconds })`.
- **`recordOutbox()` returns null while `INTEGRATION_ENABLED` is off** (contract: no stale
  YeldnIN backlog) — guard the return.
- Money = EGP integer piastres as BigInt (`formatEGP`, `egpToPiastres`); product URL key is
  `slugEn`/`slugAr` (not `slug`); images order by `sortOrder`; sellable stock =
  Σ(qtyOnHand − qtyReserved) over LIVE/NEW lots; sales exclude CANCELLED/REFUNDED orders +
  `lost` items, include pre-order lines.
- Admin list pages: copy the pattern in `/admin/inventory/requests` or `/admin/go-live`
  (searchParams as Promise, `parseListParams`/`listQs`, `ListPagination` with `locale`,
  BulkBar with `form=`-attribute checkboxes, flash via query flags).
- Notifications: `notify()` (notification-service) resolves DB template → `SEED_TEMPLATES`
  fallback (`notify-templates.ts`); respects per-customer prefs by `type`; use
  `Customer.locale` for template locale + deep-link paths.

## ⚠️ Open security action (owner)

- **Rotate the server SSH key `/root/.ssh/id_rsa`** — its private key was exposed in chat on
  2026-07-07. Regenerate on the server; if it's the GitHub deploy key, swap it in the repo's
  Deploy Keys. (Per-user `ssh veeey` client keys are separate and unaffected.)

## Waiting tasks

### Quick owner actions that unblock shipped features
- **Enable checkout verification**: place ONE test order on your own phone with an OTP, then set
  Settings › Checkout › "Require verified contact to checkout" = `true` (shipped OFF on purpose;
  SMS is live so it works today — email codes additionally need SMTP).
- **Optionally run the spam scan**: `/admin/customers` → "Scan for suspicious" → review the
  Flagged filter → bulk Block or Delete (no-orders-only safeguard applies).
- **Configure SMTP** (`/admin/providers` or Settings) → activates abandoned-cart + review-request
  emails (built, enabled, currently log-only) + order emails + email OTP verification + the weekly
  **search digest** (Setting `search.weeklyDigest`) and weekly audit report.
- **reCAPTCHA (optional)**: set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY` env vars
  on the server to activate the now-wired v3 check on login/register.
- **Add an AI provider key** (`/admin/providers` → AI section) → unblocks the brands **AR-translate
  job** (~697 brands missing Arabic; button on `/admin/brands`) AND the **attribute AI-suggest +
  one-click auto-fill** on `/admin/attributes/bulk` (+ quiz drafting, review summaries).
  Get the key at **console.anthropic.com** → add billing (pay-as-you-go) → API Keys → Create Key
  (`sk-ant-…`, shown once) → paste + "Check connection" on the Providers page. Treat it like a password.
- **Trustpilot** (built 2026-07-12): create a Trustpilot Business account → Integrations → TrustBox →
  copy the **Business Unit ID** → paste at `/admin/trustpilot`. Widgets (homepage/footer/checkout)
  render nothing until then.
- **GA4/GTM ids + Measurement Protocol secret** in `/admin/google` → activates analytics P4/P5.
- **GeoLite2-City.mmdb** at `GEOIP_DB_PATH` on the server → activates visitor geo.
- **Google Search Console API** (Task 2, added 2026-07-12): to activate auto-submit + in-admin
  indexing/performance, create a Google Cloud OAuth client (enable "Google Search Console API",
  Web app type, redirect URI `https://veeey.com/api/admin/google/gsc/callback`), paste the client
  id/secret + property at `/admin/google/search-console`, and press Connect Google. (Meta-tag
  verification + the sitemap already work without this.)
- **Privacy policy**: lawyer review + registered company name/address in §7.

### Queued next — owner decisions (V7 leftovers, 2026-07-17)
- **C3/C11/C12 taxonomy merges** — owner must supply the merge mapping for the 19 EN/AR twin top-level
  categories (72 top-level exist) + subcategorization rules for "Public Health" (596 products). Execute via the
  existing `/admin/categories/restructure` dry-run/APPLY tool; category renames now auto-create redirects.
- **C20 decision** — the audit wants the rich-text Font/Size pickers removed, but SEO-B built them at the
  owner's request. Keep, remove, or constrain to theme fonts? Ask before touching.
- **`-amp-` product slugs** — 198 live product URLs carry a stray "amp" word (the C1 escape leaked into slug
  generation at import). Fix = rename + 198 redirects = SEO churn on indexed pages; owner's call.
- **S10 real spec** — V6's S10 says "(see Improvements)" but no such section exists in V6 or V7. The shipped
  trend + top-sellers panels are the owner's interim choice ("till I give you more details"); revisit when the
  actual Improvements list arrives.

### Parked (deferred by owner 2026-07-11)
- **Owner activation runbook** — a step-by-step doc for all of the above.
- **Next growth feature** — owner picks (candidates: bundles/kits, wishlist price-drop alerts,
  loyalty perks surfacing, gift-with-purchase automation).

### Blocked on the owner (decision / account / credentials)
- **V5 audit doc — open product questions** (the code work is 100% shipped; these are decisions):
  ① UTM/campaign tracking intent — all non-Direct traffic-source rows are zero until campaigns
  carry UTMs (or the owner says how attribution should work); ② the funnel's "Orders" stage is
  deliberately DIRECT-only (annotated in the UI) — confirm that definition; ③ fulfillment location
  wording; ④ customer SSO-vs-OTP direction. (GeoLite2 mmdb is in the quick-actions list above.)
- **Payments Stage B** — live OPay + Kashier checkout; needs **sandbox credentials** (Stage A creds UI done).
  (Once cards + tokenization exist, Refill can gain online-payment autoship on top of today's COD engine.)
- ~~**Variant selector**~~ — **✅ BUILT 2026-07-13** (owner approved the schema change; see Current state).
- **YeldnIN integration** (epic V) — gated behind `INTEGRATION_ENABLED`; needs
  `INTEGRATION_CONTRACT.md` re-baselined. Also lights up the To-buy page's "Incoming" column +
  real dispatch of reorder requests (currently captured locally only).

### Deprioritized by owner (do not re-propose unless asked)
- ~~**Real Autoship/Refill subscriptions** (epic #119)~~ — **un-parked by the owner 2026-07-13 and ✅ BUILT
  the same day** (see the Refill module entry in Current state; activation = feature toggle + `refill.enabled`).
- (nothing currently parked)

### Owner in-admin / content actions (not code)
Populate product **attributes** (goal/form/dietary) so PLP facets fill — **use
`/admin/attributes/bulk`**: assign-to-selected, per-selection AI-suggest, or the one-click
**"Start auto-fill"** background job (needs the AI key; fills only missing values); add **brand
logos/stories**; set **`store.phone`**; add photos to the 3 real private products missing images
(Ipamorelin 10mg, Nordic Naturals Vit D3 Kids, Tesamorelin 10mg); set **gift stock counts**;
toggle **`preorderEnabled`** per product; run the **category restructure Apply**
(`/admin/categories/restructure`) and the **brands AR-translate** button (after the AI key);
add staff to the **Sales** department (drives the order pharmacist picker); tune the 4 homepage-SEO
fields + `analytics.retentionDays` in `/admin/settings` if desired; refine collection banners.

---

## History — V3 admin epic (from `V3 admin.docx`) — ✅ COMPLETE & DEPLOYED 2026-07-09
- **P0** `654e6e3` shared list UX (aligned filter bar / search-empty state / delete-always-confirms).
- **TAG-1** `53c4338` tags usage-count + missing-AR badge/filter; **TAG-2** slug UX (live preview,
  duplicate check via `/api/admin/slug-available`, unsaved-changes guard) in shared `EntityForm`.
- **COL-1** `collection_v3` migration (ruleJson, manualOrder, imageAlt EN/AR); **COL-2** searchable
  manual product picker with reorder; **COL-3** AR description + banner + SEO; **COL-5** storefront
  `/collection/[slug]` + `/collections` (fixed 404s); **COL-6** Shop-by-Goal mega-menu → 13 seeded
  goal collections (all non-empty after the `406198c` rule-sort fix).
- **ATTR-1..4** `2fb466d` (migration `attribute_v3`): inputType, multi-kind, unit, isFilterable,
  isRequired; AttributeValue slug + sortOrder; 29 standard attributes + 109 values seeded.
- **COL-4** rule engine (`collection-rules.ts`, pure + tests): match ALL/ANY over
  category/tag/brand/attribute/name-or-SKU (contains)/price/stock + sort; live preview in admin.

## History — 2026-07-08 hardening pass (3 review agents)
- **`09cd75a` media durability** — `media-localize` job (ran 2026-07-10, see above).
- **`1a90709` correctness** — atomic stock claims, transitionOrder compare-and-swap (no double
  restock/points/revenue), returns-aware refund restock, loyalty net clawback, coupon singleUse,
  non-destructive setCartQty, restructure apply snapshot-first.
- **`81da59e` security** — 17 admin read pages enforce permissions server-side; department
  permission fallback fixed; bilingual "no access" boundary; rate limits on
  login/register/reviews/questions/special-orders; order-confirmation page gated by `vy_orders`
  cookie or owning session.
- Known accepted leftovers (low): revenue outbox uses EGP float (contract-compatible); getCart
  line price shows first lot's price across differently-priced lots (display only); coupon usage
  limits check-then-act under extreme concurrency; lifetimeSpend reversal uses current total if
  items were lost after credit.

## History — shipped 2026-07-05 → 2026-07-08 (all deployed)
| Area | Commit | Notes |
|---|---|---|
| External-audit roadmap (P0–P3) + pre-order path | …`448647f` | P0 cart fix (loc_main), reviews, search autocomplete, PDP gallery, PLP facets, trust content, pre-order deposit |
| V1 Admin Panel | `152fdf3`…`08a1bd4` | dashboard drill-downs, analytics fixes + instrumentation, orders list, Returns `ReturnReason` (+migration) |
| Navigation builder | `b166332` | `/admin/navigation`: top bar + mega-menus fully editable; JSON Setting `nav.config` |
| AI access (MCP) | `90d3abf` | `/admin/ai-keys` scoped Bearer keys + `/admin/ai-approvals` staged writes; migration `ai_access` |
| Google services + audit CSV | `66e9537` | `/admin/google` (GA4/GTM/Search Console) + tag injection; change-log CSV + date filters |
| Homepage builder suite | `0922b29`…`a5a9129` | sections toggle/reorder/edit + gadgets; landing pages `/l/<slug>` (+`PageLayout` migration); block zones |
| PDP per-unit price + At-a-glance | `404513e` | ≈ EGP/serving in buy box; auto icon facts strip |
| Product Q&A | `d9c2187` | PDP ask form + `/admin/questions` moderation; migration |
| WhatsApp order confirmation | `8917a53` | Meta Cloud API via `/admin/providers` creds; en/ar templates |
| Staff orders A/B/C | `9d36718` `7072a82` `2aa5ddf` `e9c5ab5` | customer search/profile + address CRUD; live product picker w/ per-expiry lots + shortfall→pre-order; gifts polish + `GiftMovement` migration |
| GTM Consent Mode v2 option | `81bd91b` | gated (default) or always-on tag loading |
| More AI apply-actions | `10c092a` | approval inbox applies question.answer / cms.update / blog.update |
| Audit reports + retention | `ca87b1e` | weekly staff-activity email + daily change-log purge crons |
| SEO epic A/B/C | `843517e` `ab1e538` `b76c0a1` `ad500f2` `0a5d5cb` `db68345` | products data-quality/bulk-price tools; editor `</>` HTML + scoped CSS; migration `product_seo_fields`; bilingual RankMath-style editor; PDP head; `/admin/seo-health` |
| V2 — Go-Live / Brands / Categories | `e89a3b7` `6027e4a`…`c89e899` | migration `brand_category_seo`; entity-aware SeoEditor; brands AR-translate job; category tree + restructure dry-run/APPLY tool |
| TEAM — departments replace roles | `493d512` `c6209dc` | migration `departments`; union-of-teams permissions; `/admin/departments` |
| Earlier foundations | — | admin config epics (PAY/STAT), admin lists toolkit, WooCommerce import + live sync, Chewy re-skin + theme editor + admin re-skin, social login, payments Stage A, P0–P15 build plan |

## Notes for whoever picks this up
- **This doc is the portable source of truth** — per-user assistant memory does not transfer
  between Windows accounts. Everything operationally important from that memory has been folded
  into the sections above.
- Build phase-by-phase; verify with the gate; commit per feature; deploy via `ssh veeey`
  (set up per the "Continuing from another account" section); update this doc after each epic.
