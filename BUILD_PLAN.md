# Veeey — Build Plan (phased milestones for the coding agent)

> Each phase ends in a green build + tests. Reference FR-IDs from `VEEEY_PRD.md`. Don't start a phase
> before its dependencies. Gated phases (⛔) wait for an external prerequisite. **Cross-cutting**
> concerns (bottom) apply to every phase. Rebalanced 2026-06-13 to include analytics, personalization,
> the Play section, and the expanded feature set.

## P0 — Bootstrap
Next.js (App Router) + TS strict + Tailwind v4 + shadcn (import `v0-export/` components & tokens)
+ Prisma + Postgres + Auth.js + next-intl (AR/EN/RTL) + zod + vitest/Playwright + pg-boss. CI
(tsc/lint/test/build). `AGENTS.md`, repo-root docs, `.env.example`. App shell + locale routing + design tokens
+ **PWA shell** (installable, offline-safe — FR-PLAT-03) + **consent banner** scaffold (FR-BEH-02) +
**A/B-testing/feature-flag framework** hooks (FR-PLAT-01).

## P1 — Data model & seed
Full Prisma schema from SPEC §4 + PRD (Product, Brand, Category, Tag, Attribute, **Lot**, Location,
**ShippingZone/Area**, Customer, Address, Order/Item, Coupon, Loyalty, Referral, **WishlistItem +
WishlistList(named)**, CompareList, **ProductChangeEvent**, **AnalyticsEvent/Session**, Review(+media),
Return, StocktakeSession/Count, MovementLedger, **Quiz/Game/PlayEntry**, CmsPage, BlogPost, Redirect,
NotificationTemplate, User/Role/Permission, IntegrationClient, AuditLog). Migrations + **synthetic seed**.

## P2 — Identity & RBAC  (FR-ACC-01, FR-RBAC-01/02)
Auth.js (email + Google/Meta/Apple/X + guest), reCAPTCHA. Users/roles/permissions; admin shell with
RBAC gating; customer auth. Audit-log scaffold.

## P3 — Catalog & content  (A, FR-CAT-*, FR-CMS-*, FR-SEO-07)
Products/categories/brands/tags/attributes + admin CRUD; media upload (drag/paste) → WebP/CDN;
per-entity **SEO/AEO fields**; collections; CMS pages + blog. Governed attribute schema. Capture
**size + daily-dosage** fields that power the duration calculator (FR-HEALTH-01).

## P4 — Storefront (read)  (H, FR-SF-*, FR-SCH-*, FR-REV-*)
Homepage (wire v0; **rename tier cards → Veeey Green / VeeeyIP / Veeey Select**), category page + instant
filters, PDP (+ **duration calculator** FR-HEALTH-01), search (**Typesense/Meilisearch** + typo tolerance + Arabic), **reviews
display + photos/videos (FR-REV-04) + AI summaries (FR-REV-05)**, entry disclaimer, WhatsApp/phone,
full RTL/AR, JSON-LD everywhere.

## P5 — Event pipeline & analytics foundation  (T, FR-BEH-01/02)
**First-party clickstream pipeline** (every interaction → per-customer journey/path) + **PostHog +
Microsoft Clarity** (replay/heatmaps) + **consent/anonymized mode**. Establish early so every later
feature instruments events. (Dashboards + report builder come in P13.)

## P6 — Inventory, lots, FEFO  (B, N, FR-INV-*, FR-STK-*)
Lots (product×expiry×location), FEFO + lot reservation, price-per-expiry selector + suggestion engine,
stock-in intake (mock the YeldnIN trigger), multi-location, **stocktake module** + movement ledger.

## P7 — Cart, checkout, shipping  (I, J, K, FR-CHK-*, FR-PAY-*, FR-SHP-*)
Cart + lot binding/soft-hold + **related/upsell on cart & checkout (FR-CAT-04)**; addresses (governorate→
area); **Shipping Zones module + "Deliver to" selector + 3 types/fees** (Fast&Free 0 / UltraFast 400 /
Pick-from-Office 100 — FR-SHP-06/07/08); checkout (editable fields) + **deposit mode 25%** +
**discreet packaging (FR-CHK-05)** + **express/1-click checkout: saved-card + Apple Pay + Google Pay
(FR-CHK-06)**; payment adapters (OPay, Kashier, COD, POS, bank, wallet) + webhooks; **fraud detection
(FR-PLAT-02)**.

## P8 — Orders & fulfillment  (L, P, FR-ORD-*, FR-RET-*)
Order lifecycle (11 statuses) + event-driven progression, admin order mgmt (columns, metadata, edit-in-
Hold with lot-correct stock), **PDF invoice** (pharmacist/expiry/weight, editable template), **gifts**
(separate inventory, hidden from customer), tracking → email, returns + quarantine, Excel export.

## P9 — Loyalty, tiers, coupons, wishlist, compare, referrals  (C, E, F, FR-PRC-*, FR-WSH-*, FR-CMP-*)
Tiers **Veeey Green→VeeeyIP→Veeey Select** (renameable, manual) + earn rates + **per-tier product rules
(category/tag/attribute → price/visibility/availability)** + **per-tier UI theming + merchandising
(FR-PRC-08)**; points (200=1 EGP) + redemption; advanced coupon engine; referrals; **wishlist +
price-drop/back-in-stock alerts + multiple/named/shareable lists (FR-WSH-05)**; compare (≤4).

## P10 — Personalization  (Y, FR-PERS-*)
**Rule-based personalization engine** + **personalized homepage rows** (Recently viewed, Buy again,
Recommended by goal, Because you viewed X, Popular in your tier) + **personalized search ranking** +
**Frequently-bought-together / Customers-also-bought**. (ML/collaborative filtering = Phase 2.)

## P11 — Engagement: Play, quizzes, health tools  (Z, FR-PLAY-01, FR-QUIZ-01, FR-REPL-01)
**Play section** (quizzes + games; **AI-generated quizzes**) + **guided selling quiz** ("find your
supplement / build your regimen") + basic gamification (badges/challenges) + **replenishment reminders**
(consumption-based).

## P12 — Notifications & templates  (S, FR-NOT-*)
Email/SMS/WhatsApp adapters + event→channel matrix + editable bilingual templates; jobs for abandoned
cart, review requests, wishlist/back-in-stock alerts, replenishment reminders.

## P13 — Analytics dashboards, feeds & AI APIs  (T, V, R, FR-ANL-*, FR-MCP-*, FR-SEO-06)
First-party analytics **dashboards + self-serve report builder**; attribution (UTM/source/session);
GA4 + Meta CAPI; Google Merchant/Meta feeds; **public AI content API + llms.txt**; **admin REST/OpenAPI
+ embedded MCP server** (staged-autonomy, audit, RBAC); A/B-test results UI.

## P14 — YeldnIN integration  ⛔ GATED
Only after the contract is **re-baselined against the latest YeldnIN description**. Implement the live
client/webhooks per `INTEGRATION_CONTRACT.md` (HMAC, idempotency, outbox), resolve expiry-capture
location (FR-INV-06), keep `INTEGRATION_ENABLED` default off until staging-verified.

## P15 — Migration tooling  ⛔ GATED
Only after a fresh re-export (findings §10). ETL: SKU generation, brand/attribute/tag/city normalization
maps, pharmacist→user aliases, expired-lot write-off, customer merge + tier/points seeding, order/status
mapping, reviews date-clamp, full redirects, pages/posts, **Arabic MT pass**. Dry-run + validation
reports; opening stocktake establishes true stock.

## P16 — Transition mirror (Egypt Vitamins parallel run)  ⛔ GATED / OPTIONAL
Only when the parallel-run window is planned, and on only after Veeey is fully tested. **Veeey = source
of truth for inventory + orders.** Isolated, feature-flagged, **removable** module (WooCommerce
REST/webhooks ↔ Veeey API): Woo reads stock from Veeey + pushes its orders into Veeey; products +
customers sync; observable + idempotent; never corrupts Veeey's authoritative data. **Cleanly
decommissioned** after full migration. (FR-MIR-01..04.)

## Cross-cutting (every phase)
Tests, accessibility, performance/Core-Web-Vitals, security (RBAC/rate-limit/validation/audit/fraud),
i18n (AR/EN/RTL), **event instrumentation** (every feature emits clickstream events once P5 lands),
**A/B-test-ready** components, consent honored, PWA-safe, no real PII, no hard-coded business numbers.
**Launch security program (NFR-08):** WAF/bot protection, payment idempotency + tokenization, secrets
rotation, dependency scanning; **pen-test before go-live**.
