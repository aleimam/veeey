# Veeey — Project Status & Handoff

> Living status/handoff doc. **Repo-committed so it travels with the code** (unlike per-user
> assistant memory). Update it when features ship or the backlog changes.
> **Last updated: 2026-07-12.** Authoritative product docs: `VEEEY_PRD.md`, `VEEEY_SPEC.md`,
> `BUILD_PLAN.md`, `AGENTS.md` (build rules — read first), `DEPLOYMENT.md`, `SECURITY.md`, `README.md`.

## Current state

- **Live** at **veeey.com**. Latest deployed commit: **`8459842`** (2026-07-12). All
  **47 Prisma migrations applied**; `pm2` processes `veeey` (web) + `veeey-worker` (jobs) healthy;
  `/api/health` → `{"status":"ok"}`. Verify gate green: typecheck · lint · **350 unit tests** · build.
- Stack: Next.js 16 (App Router, Turbopack) · TypeScript strict · Prisma 7 + Postgres ·
  Auth.js · next-intl (AR/EN, RTL) · Tailwind v4 · pg-boss v12.

### Shipped 2026-07-11 → 2026-07-12 (newest first)

| Feature | Commits | Notes |
|---|---|---|
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
  emails (built, enabled, currently log-only) + order emails + email OTP verification.
- **reCAPTCHA (optional)**: set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` + `RECAPTCHA_SECRET_KEY` env vars
  on the server to activate the now-wired v3 check on login/register.
- **Add an AI provider key** (`/admin/providers`) → unblocks the brands **AR-translate job**
  (~697 brands missing Arabic; button on `/admin/brands`).
- **GA4/GTM ids + Measurement Protocol secret** in `/admin/google` → activates analytics P4/P5.
- **GeoLite2-City.mmdb** at `GEOIP_DB_PATH` on the server → activates visitor geo.
- **Google Search Console**: verify veeey.com, submit `sitemap.xml`, request-index the homepage.
- **Privacy policy**: lawyer review + registered company name/address in §7.

### Parked (deferred by owner 2026-07-11)
- **Owner activation runbook** — a step-by-step doc for all of the above.
- **Next growth feature** — owner picks (candidates: bundles/kits, wishlist price-drop alerts,
  loyalty perks surfacing, gift-with-purchase automation).

### Blocked on the owner (decision / account / credentials)
- **Payments Stage B** — live OPay + Kashier checkout; needs **sandbox credentials** (Stage A creds UI done).
- **Trustpilot** homepage strip + TrustBox — needs a **Trustpilot account**.
- **Variant selector** (size/flavor/count) — catalog is single-SKU; needs owner **OK for a schema change**.
- **YeldnIN integration** (epic V) — gated behind `INTEGRATION_ENABLED`; needs
  `INTEGRATION_CONTRACT.md` re-baselined. Also lights up the To-buy page's "Incoming" column +
  real dispatch of reorder requests (currently captured locally only).

### Deprioritized by owner (do not re-propose unless asked)
- **Real Autoship/Refill subscriptions** (epic #119) — owner said "ignore refill epic" (2026-07-08);
  buy-box subscribe-&-save stays visual-only (`refill.enabled` default false).

### Owner in-admin / content actions (not code)
Populate product **attributes** (goal/form/dietary) so PLP facets fill; add **brand
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
