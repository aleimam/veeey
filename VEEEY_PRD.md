# Veeey — Product Requirements Document (PRD)

> **Status:** v1.1 for review · 2026-06-13 (added: behavioral analytics, personalization, Play/quizzes,
> shipping-zone fees, tier rename, AI access, transition mirror, + advanced features — see §6 Y/Z)
> **Purpose:** the single document to read, review, and confirm that every agreed requirement is
> captured correctly before build. Complements `VEEEY_SPEC.md` (technical design),
> `MIGRATION_FINDINGS.md` (data), and `INTEGRATION_CONTRACT.md` (YeldnIN API).
>
> **How to review:** each requirement has an ID (e.g. `FR-CAT-03`) and a priority. Reference IDs when
> you want a change. Priorities: **P0** = required for v1 launch · **P1** = v1 if time · **P2** = a
> later phase. ⚠️ = open decision (safe default exists). At the end is a §-by-§ sign-off checklist.

---

## 1. Product vision

Veeey ("Health Inside", veeey.com) is a premium, bilingual (Arabic/English) B2C eCommerce store
selling dietary supplements and health devices **imported directly from the USA, UK & EU**, replacing
egyptvitamins.com. It serves elite (A+++) Egyptian customers, prices in EGP, and is differentiated by:
**expiry shown before you buy**, **price-per-expiry**, **special-order-anything with a compensation
guarantee**, **UltraFast 3–6h delivery**, **pharmacist curation**, and a **loyalty/tier program**.

## 2. Business objectives & success metrics

| Objective | Indicative KPI |
|---|---|
| Migrate off WooCommerce with no SEO/customer loss | 100% of live URLs 301-redirected; ≥95% organic traffic retained 90 days post-launch |
| Lift conversion & AOV for premium customers | AOV ≥ current 9,603 EGP; conversion rate uplift vs old site |
| Grow repeat purchase via loyalty/tiers | Returning-customer rate; points redemption rate; tier migration |
| Reduce inventory loss from expiry | Expiry write-off %; short-expiry sell-through |
| Deliver on special-order promise | On-time special-order %; compensation paid % |
| Operational efficiency | Stock-count accuracy; order-processing time; UltraFast SLA hit-rate |

## 3. Scope & release phasing

**In scope (v1 / P0):** full commerce; lots/FEFO/price-per-expiry; **tiers (Veeey Green/VeeeyIP/Veeey
Select) + per-tier rules & UI**/loyalty/referrals/coupons; accounts & portal; **wishlist (+ alerts,
multiple/named/shareable)**; compare; search **+ personalized ranking**; **Shipping Zones + Deliver-to
(Fast&Free/UltraFast/Pick-from-Office)**; checkout & payments **+ express (Apple/Google Pay) + discreet
packaging**; orders & fulfillment; special orders + compensation; stocktake; returns; gifts; **reviews
(+photos/videos + AI summaries)**; CMS/blog/FAQ; SEO/AEO + feeds; notifications & editable templates;
**behavioral event pipeline + PostHog/Clarity + consent**; **rule-based personalization + personalized
homepage**; **Play section + AI quizzes + guided selling quiz**; **duration calculator + replenishment
reminders**; **A/B testing, fraud detection, PWA**; first-party analytics + report builder; RBAC; AI
access (admin API + MCP, staged); integrations (payments/shipping/marketing/messaging); AR/EN; data
migration. *(Transition mirror: priority P1, build phase P16, gated.)*

**Out of scope (Phase 2+, P2):** AI Health Assistant; advanced gamification (leaderboards); NFC loyalty
cards; **ML/predictive** personalization & replenishment; subscriptions; full visual page-builder;
dedicated-pharmacist concierge; supplement interaction checker; consultation booking; regimen builder;
visual/voice search; broader Suggestions/Insights engine; 2nd physical location; native mobile app;
GTIN backfill; barcode stocktake.

## 4. Actors

- **Guest** — browses, searches, compares, can checkout as guest.
- **Customer** — registered; tiered **Veeey Green / VeeeyIP / Veeey Select** (renameable); account portal.
- **Staff roles** (RBAC, §V): Super Admin, Admin, Pharmacist (Sales), Operations, Content/SEO,
  Marketing, Finance, Customer Support, Courier.
- **Systems:** **YeldnIN** (purchasing/logistics/finance/couriers), payment gateways, carriers,
  Google/Meta, messaging providers, Trustpilot, **Claude** (permission-scoped admin agent).

## 5. System context (summary)

Two systems, one event-driven API. **Veeey** (public, Next.js+Postgres, Hetzner+CWP, PM2/nginx) owns
catalog, live stock & lots, accounts, pricing, orders, payments, content, analytics. **YeldnIN**
(internal) owns requests, purchasing, trips/receiving, finance, and own-courier/UltraFast execution.
SKU is the shared key; stock crosses once at "stock-in." Full contract in `INTEGRATION_CONTRACT.md`.

---

## 6. Functional requirements

### A. Catalog & product management

| ID | Requirement | Pri |
|---|---|---|
| FR-CAT-01 | Products with bilingual (AR/EN) name, slug, short & long description, images (multiple), brand, product type, categories (hierarchical), tags, structured attributes, weight. | P0 |
| FR-CAT-02 | Every product has a unique **SKU**; new products **auto-generate** a SKU; legacy WP id preserved. | P0 |
| FR-CAT-03 | Curated collections (Bestsellers, Offers, Devices, Premium, New, Trend…) built from category/tags or hand-picked. | P0 |
| FR-CAT-04 | Per-product **related products** = auto (same category/tags) + manual overrides (set on the product page) + **AI-set later**; surfaced as **upsell/cross-sell blocks across the shopping journey: product page + cart + checkout**. | P0 |
| FR-CAT-05 | Per-entity (product/category/tag/brand) editable SEO meta + JSON-LD, per locale. | P0 |
| FR-CAT-06 | Image upload everywhere (products/categories/tags/brands) via drag-drop, paste, or file; auto WebP + CDN. | P0 |
| FR-CAT-07 | Product visibility states (published/draft/archived) + catalog visibility. | P0 |
| FR-CAT-08 | Governed attribute schema (cleaned from legacy); supplement vs device attribute sets. | P0 |
| FR-CAT-09 | Product **weight** stored and shown on invoices per line. | P0 |

### B. Inventory, lots, expiry, FEFO, price-per-expiry

| ID | Requirement | Pri |
|---|---|---|
| FR-INV-01 | Stock tracked as **lots**: product × expiry × **location**, each with qty, cost, optional price override, source batch (YeldnIN). | P0 |
| FR-INV-02 | **Nearest-expiry** date shown in listings; the **selected lot's exact expiry** follows the line item through cart → checkout → order → invoice → emails. | P0 |
| FR-INV-03 | **FEFO**: default sale picks nearest-expiry lot; lot reserved (timed soft-hold) at add-to-cart; graceful auto-rebind + notice if it lapses. | P0 |
| FR-INV-04 | **Price-per-expiry**: a lot can be Sale-flagged with its own price; customer picks expiry option → price changes; far-expiry full-price purchase reserves the far lot. | P0 |
| FR-INV-05 | System **suggests** short-expiry discounts from (stock level, 3-mo sales velocity, consumption duration = f(size,dosage)); **pharmacist confirms**. | P1 |
| FR-INV-06 | **Stock-in intake** (triggered by YeldnIN `shipment.received`): Veeey receives lots; Ops/Sales confirm photos, set price-per-expiry, publish to live catalog. **Expiry-capture location (YeldnIN vs Veeey) reconciled against latest YeldnIN at execution (FR-INT-05).** | P0 |
| FR-INV-07 | Multi-location data model now; FEFO & stocktake operate per location (1 location at launch). | P0 |
| FR-INV-08 | Lot lifecycle: LIVE / QUARANTINE / EXPIRED / WRITTEN_OFF; expired lots excluded from sale. | P0 |

### C. Pricing, tiers, loyalty, referrals, coupons

| ID | Requirement | Pri |
|---|---|---|
| FR-PRC-01 | Tiers **Veeey Green → VeeeyIP → Veeey Select** (entry→top); **names admin-renameable**; assigned **manually by staff**. | P0 |
| FR-PRC-02 | Tier-based **earn rate** (configurable, default 1/2/3 points per EGP). | P0 |
| FR-PRC-03 | **Per-tier product-behavior rules** keyed by **category / tag / attribute** → differ **price**, **visibility**, and/or **availability** by tier (admin-defined). ⚠️ exact rules to be filled. | P0 |
| FR-PRC-08 | **Per-tier UI**: theming (tier colors/badge/hero accents/banners) **+ tier-specific merchandising** (featured products, collections, offers shown per tier). Fully distinct per-tier layouts = P2. | P0 |
| FR-PRC-04 | Loyalty: redeem **200 pts = 1 EGP**; bonus points for reviews; expiry **configurable, default never**. | P0 |
| FR-PRC-05 | Points + coupons + tier discounts **stack**. | P0 |
| FR-PRC-06 | **Referral** program: admin-configurable rule (default 100% of invitee points yr1, 50% after); invitee welcome perk. | P0 |
| FR-PRC-07 | **Advanced coupon engine**: %/fixed/free-item/min-spend/first-order/category- or tier-limited/single-use/expiry/stacking rules. | P0 |

### D. Customer accounts & portal

| ID | Requirement | Pri |
|---|---|---|
| FR-ACC-01 | Registration/login: email/password + **social (Google, Meta, Apple, X)** + **guest checkout**; reCAPTCHA v3. | P0 |
| FR-ACC-02 | Portal: order history, ongoing & **special-order tracking (visual timeline)**, structured addresses, saved payment methods, profile. | P0 |
| FR-ACC-03 | Points balance + redemption; **tier badge**; portal visuals adapt to tier. | P0 |
| FR-ACC-04 | **Quick reorder** (re-add a past order to cart). | P0 |
| FR-ACC-05 | Referrals view (invite, code, earned points). | P0 |
| FR-ACC-06 | Migrated customers set a new password (email) or use social; no password import. | P0 |

### E. Wishlist & alerts

| ID | Requirement | Pri |
|---|---|---|
| FR-WSH-01 | Add/remove products to wishlist from card & PDP. | P0 |
| FR-WSH-02 | Per-item alert flags: **price-drop** & **back-in-stock** (default on), delivered via email/SMS/WhatsApp per customer preference + consent. | P0 |
| FR-WSH-03 | Price-drop alert fires when effective price falls past a configurable threshold (default ≥5%); **frequency cap** (≤1/product/customer/N days). | P0 |
| FR-WSH-04 | Back-in-stock alert fires once per out→in transition (new lot published). | P0 |

### F. Compare

| ID | Requirement | Pri |
|---|---|---|
| FR-CMP-01 | Add up to **4** products to a compare list (card/PDP toggle); sticky compare bar; client-side for guests, persisted for members. | P0 |
| FR-CMP-02 | Comparison page: side-by-side columns; rows aligned by attribute schema (Size, Form, Servings, Conc, Ingredients, origin, certifications…), + brand, tier price, rating, expiry, categories, tags, stock state, add-to-cart; missing = "—"; optional difference highlight; mobile horizontal scroll. | P0 |

### G. Search

| ID | Requirement | Pri |
|---|---|---|
| FR-SCH-01 | Search across products, brands, tags, categories, attributes; instant; **typo-tolerant**; **Arabic-aware**. Powered by a **dedicated search engine (Typesense or Meilisearch)** — not Postgres FTS — to handle the catalog size, Arabic, typo tolerance, and personalized ranking. | P0 |
| FR-SCH-02 | Log searches + zero-result queries + post-search outcomes. | P0 |
| FR-SCH-03 | **Search-performance dashboard** (top queries, zero-result, conversion). | P1 |

### H. Storefront presentation

| ID | Requirement | Pri |
|---|---|---|
| FR-SF-01 | **Homepage** per the locked design (`v0-export/`): hero, category cards, trust strip, shop-by-goal, bestsellers (expiry chips, ratings, points, badges, wishlist), price-per-expiry selector, special-order journey, tiers, testimonials, footer, floating WhatsApp. | P0 |
| FR-SF-02 | **PDP**: gallery w/ zoom, inline price-per-expiry selector, tier price + points, stock states (in-stock / pre-order 25% deposit / out-of-stock "notify me"), specs table, reviews, related + cross-sell, sticky mobile add-to-cart, prominent expiry. | P0 |
| FR-SF-03 | **Category/listing**: instant multi-select filters (goal/brand/form/concern/certifications/price), in-stock/offers/pre-order toggles, sort (incl. nearest expiry), grid, special-order empty-state. | P0 |
| FR-SF-04 | **Entry disclaimer pop-up** on first visit (supplement disclaimer). | P0 |
| FR-SF-05 | Floating **WhatsApp** + **phone-call** buttons sitewide. | P0 |
| FR-SF-06 | **Configurable theming** from dashboard (colors, logos, fonts, homepage blocks, banners, menus). Full page-builder = P2. | P1 |

### I. Cart & checkout

| ID | Requirement | Pri |
|---|---|---|
| FR-CHK-01 | Multi-step, mobile-first, guest checkout; **editable checkout fields** (admin). | P0 |
| FR-CHK-02 | Lot binding + timed soft-reservation; expiry shown per line. | P0 |
| FR-CHK-03 | **Deposit mode**: pre/special orders charge **25% deposit**, balance on delivery. | P0 |
| FR-CHK-04 | No VAT/tax; shipping fee per chosen type (FR-SHP-07); reCAPTCHA on checkout. | P0 |
| FR-CHK-05 | **Discreet packaging** option at checkout (plain, unbranded) — for sensitive products. | P0 |
| FR-CHK-06 | **Express / one-click checkout** for returning customers — saved-card express (Kashier/OPay) **+ Apple Pay** (available in Egypt) **+ Google Pay/Wallet** (customers with it via foreign banks). | P0 |

### J. Payments

| ID | Requirement | Pri |
|---|---|---|
| FR-PAY-01 | Methods: **OPay, Kashier** (online), **COD, POS-on-delivery, bank transfer, mobile wallet**. | P0 |
| FR-PAY-02 | Admin orders the gateway list (preferred/cheaper first). | P0 |
| FR-PAY-03 | Gateway webhooks confirm payment; payment state tracked per order. | P0 |
| FR-PAY-04 | Refund support per method; COD refunds via bank transfer (see Returns). | P0 |

### K. Shipping, fulfillment, couriers, UltraFast

| ID | Requirement | Pri |
|---|---|---|
| FR-SHP-01 | **"Fast & Free" standard shipping is free** (absorbed); premium types carry fees (FR-SHP-07). Courier chosen by **address zone**; Ops assigns per order (system may suggest). | P0 |
| FR-SHP-02 | **Aramex** + **SMSA** via carrier APIs (label/tracking) handled by Veeey directly. | P0 |
| FR-SHP-03 | **Own-courier + UltraFast** routed to YeldnIN **Couriers module**; delivery status flows back to Veeey & customer. | P0 |
| FR-SHP-04 | **UltraFast** (name ⚠️ TBD): 3–6h delivery in admin-defined Greater-Cairo areas. | P0 |
| FR-SHP-05 | Tracking number input auto-emails customer + updates order timeline. | P0 |
| FR-SHP-06 | **Shipping Zones module** — admin map of Egypt (Egypt-only). **Hybrid granularity**: area/district level inside Greater Cairo, governorate level elsewhere. Per area, admin sets available **shipping types + estimated delivery time**, **UltraFast eligibility**, and behind-the-scenes **courier mapping** (Aramex/SMSA/own → feeds Ops suggestion). | P0 |
| FR-SHP-07 | Three customer-facing types (fees admin-configurable): **"Fast & Free"** = **0 EGP**, ETA varies by address/area; **UltraFast** = **400 EGP**, 3–6h eligible Greater-Cairo areas; **Pick from Office** (click & collect) = **100 EGP**. | P0 |
| FR-SHP-08 | **"Deliver to [area]" selector** (Amazon-style) showing available types + ETA on **product page, cart, and checkout**, plus a **public Shipping Info page** listing areas/times. ETA combines with stock state: in-stock → area window; pre/special-order → SLA deadline + area window. | P0 |

### L. Orders & order management

| ID | Requirement | Pri |
|---|---|---|
| FR-ORD-01 | Order lifecycle statuses (from live data): Pending Confirmation, Processing, Hold, Shipped, **Cash Delivered**, **Card Delivered**, Cancelled, Refunded, Failed (+ Draft/Edit working states). Customer-facing timeline: Placed → Processing → Shipped → Delivered. | P0 |
| FR-ORD-02 | **Event-driven** status progression (e.g. add AWB/tracking → Shipped) + manual override. | P0 |
| FR-ORD-03 | **Edit orders in Hold**: add/remove items with real-time correct-lot stock updates. | P0 |
| FR-ORD-04 | Admin order-list columns: **Pharmacist, Pay Check (No/Yes/Problem), Tracking, Order Source**. | P0 |
| FR-ORD-05 | Order metadata (admin-editable lists): **Customer Type** (Discount Chaser/Doctor Recommended/Sales Advice/Self Ordering), **Product Type** (Miscellaneous/Male Support/Premium/New/Trend). | P0 |
| FR-ORD-06 | **Pharmacist** recorded per order + printed on invoice. | P0 |
| FR-ORD-07 | One-click actions: change status, add/edit tracking, print PDF invoice. | P0 |
| FR-ORD-08 | **PDF invoice** incl. pharmacist name + **per-line expiry** + **per-line weight**; auto-email; **editable template**. | P0 |
| FR-ORD-09 | Display customer's order history (count + value) on order detail. | P1 |
| FR-ORD-10 | **Gifts**: staff manually add 0-value code-named gifts (Gx-*) from **separate gift inventory**; **hidden from customer everywhere**; shown on internal packing slip; cost booked as promotional expense; gift stock + optional expiry tracked. | P0 |
| FR-ORD-11 | Export orders/customers/products to Excel with **selectable date range + columns**. | P0 |

### M. Special orders & compensation

| ID | Requirement | Pri |
|---|---|---|
| FR-SPO-01 | Customer requests **any** product from abroad (or pre-orders a listed one); creates a YeldnIN request; **25% deposit**. Pre-order = special-order (same flow); suggested products offered but any product allowed. | P0 |
| FR-SPO-02 | Deadline computed from product-type/supplier SLA (e.g. Fast 20d / Manufacturer 30d / Injection 40d), shown to customer. | P0 |
| FR-SPO-03 | **Automatic compensation** computed in Veeey from configurable late-windows (⚠️ exact bands TBD), applied to the customer's balance, using YeldnIN milestone timestamps. | P0 |
| FR-SPO-04 | Customer sees a **live special-order tracker** (status/ETA). | P0 |

### N. Stocktake / physical inventory

| ID | Requirement | Pri |
|---|---|---|
| FR-STK-01 | Sessions named by start month, **per location**, multi-day/phase, chunked by category/tag/brand, **global coverage meter**. | P0 |
| FR-STK-02 | **Phase 1 Forward**: products with stock > 0; per-lot inline adjust; add/fix expiry; green label on adjust; posts to live stock immediately; re-openable until close. | P0 |
| FR-STK-03 | **Expected on shelf = live stock + Hold/Processing reservations**; **sales net-out by timestamp** (kill mid-count errors); visible counting + variance highlight + reason codes. | P0 |
| FR-STK-04 | **Phase 2 Reverse**: register physical items not in the system. | P0 |
| FR-STK-05 | Uncounted at close → **flagged, stock unchanged** (never auto-zeroed). | P0 |
| FR-STK-06 | Immutable session snapshot + **per-lot/location movement ledger** (reconstruct: last count − dispatched + arrived). PDF/XLSX export. | P0 |

### O. Returns & refunds

| ID | Requirement | Pri |
|---|---|---|
| FR-RET-01 | Customer-initiated return request in portal (reason codes). | P0 |
| FR-RET-02 | Returned stock → **quarantine** for pharmacist review (re-shelf to correct lot or write off; never auto-resell). | P0 |
| FR-RET-03 | Refund via system; **COD orders refunded by bank transfer**; option to refund as store credit/points. | P0 |

### P. Reviews & ratings

| ID | Requirement | Pri |
|---|---|---|
| FR-REV-01 | Native product reviews (rating + text + optional media); import legacy ~1,028 (date-clamped). | P0 |
| FR-REV-02 | Review rich-snippets (AggregateRating JSON-LD); bonus loyalty points for reviews. | P0 |
| FR-REV-03 | Display live **Trustpilot** brand rating widget (+ Google Business). | P1 |

### Q. CMS, blog, FAQ, policies

| ID | Requirement | Pri |
|---|---|---|
| FR-CMS-01 | Bilingual CMS pages addable anytime (Policies, About, FAQ, any page). | P0 |
| FR-CMS-02 | Blog (Medical Blog) migrated + new posts; bilingual; citable markup. | P0 |

### R. SEO / AEO & feeds

| ID | Requirement | Pri |
|---|---|---|
| FR-SEO-01 | SSR, per-locale URLs (`/en`,`/ar`), hreflang, canonicals. | P0 |
| FR-SEO-02 | **301 redirects** from the full legacy Rank Math set (re-export); preserve slugs where possible. | P0 |
| FR-SEO-03 | JSON-LD (Product/Offer/AggregateRating/Brand/Breadcrumb) sitewide; sitemaps; llms.txt. | P0 |
| FR-SEO-04 | Google Merchant Center + Meta Catalog **product feeds** (bilingual, auto-refresh). | P0 |
| FR-SEO-05 | Migrate Rank Math focus keywords + meta descriptions into per-entity SEO fields. | P1 |
| FR-SEO-06 | **Public AI-readable content API/feed** (authoritative structured JSON/markdown of products + content) + **llms.txt**, so external AI engines (ChatGPT/Perplexity/Gemini) ingest & recommend Veeey accurately. | P1 |
| FR-SEO-07 | **Every entity** (product/category/tag/brand/page/blog/collection) has editable **SEO + AEO fields** (meta, slug, structured-data overrides, AI summary, FAQ, keywords), per locale, **writable via the admin API** (humans now, Claude later). | P0 |

### S. Notifications & templates

| ID | Requirement | Pri |
|---|---|---|
| FR-NOT-01 | Provider-agnostic adapters for **Email + SMS + WhatsApp**. | P0 |
| FR-NOT-02 | Event→channel matrix: placed, paid, shipped, delivered, special-order milestones, compensation, **wishlist price-drop**, **back-in-stock**, review request, abandoned cart. | P0 |
| FR-NOT-03 | All templates (PDF invoice, on-screen invoice, emails, SMS, WhatsApp) **editable from dashboard**, bilingual, with merge variables. | P0 |

### T. Analytics & dashboards

| ID | Requirement | Pri |
|---|---|---|
| FR-ANL-01 | **First-party** analytics (owned data) across Sales, Customers (RFM/cohorts/LTV/retention/tiers), Products & inventory (incl. **expiry aging**), Loyalty, Marketing/attribution, Fulfillment (courier perf, UltraFast SLA), Special orders (deadline/compensation), Search & behavior. | P0 |
| FR-ANL-02 | **Self-serve report/chart builder** — compose any graph, compare any figures/periods, segment, export. | P0 |
| FR-ANL-03 | **Source/UTM/referrer + location tracking** per user/session/order; full audit/history on everything; behavior (page time, funnel). | P0 |
| FR-ANL-04 | GA4 + Meta Pixel/**CAPI** (server-side) + Search Console + Google Ads. | P0 |

### U. RBAC & staff

| ID | Requirement | Pri |
|---|---|---|
| FR-RBAC-01 | Admin-configurable roles & section-level permissions. Draft roles: Super Admin, Admin, Pharmacist, Operations, Content/SEO, Marketing, Finance, Customer Support, Courier. ⚠️ confirm matrix. | P0 |
| FR-RBAC-02 | Every permission scoped per role; data visibility respects role. | P0 |

### V. AI access — Claude & other AI models (read + write)

| ID | Requirement | Pri |
|---|---|---|
| FR-MCP-01 | **Model-agnostic admin API** (REST + OpenAPI) exposing read + write capabilities to AI/automation, authenticated via scoped API keys/OAuth. | P1 |
| FR-MCP-02 | **Embedded MCP server** wrapping that API so Claude (and MCP-compatible models) connect natively. | P1 |
| FR-MCP-03 | AI governed by the **same RBAC** as humans (an AI "role"). **Reads freely + drafts/stages writes**; **high-impact actions** (publish live, change live prices, send customer messages, refunds) require **human approval**; autonomy grantable per capability over time. | P1 |
| FR-MCP-04 | Every AI action **audit-logged**, rate-limited, attributable to the agent/key, reversible where possible. | P1 |
| FR-MCP-05 | AI can read/write **catalog, content, and SEO/AEO fields** within its permissions (enables later Claude-driven SEO/AEO optimization). | P1 |

### W. Restricted items & compliance

| ID | Requirement | Pri |
|---|---|---|
| FR-RES-01 | Per-product **restriction profile** with independent toggles: hide from public catalog · hide from feeds · disable card payments · require login · tier-gate · age/consent. **Default off**; set per product anytime after legal review. | P0 |

### X. Internationalization

| ID | Requirement | Pri |
|---|---|---|
| FR-I18N-01 | Full **AR + EN** on every page; RTL mirroring for Arabic; Poppins (Latin) + Cairo (Arabic). | P0 |
| FR-I18N-02 | Catalog: **MT-translate all products** for launch; pharmacist reviews medical content of live subset (in-stock + bestsellers) pre-launch; tail rolling. | P0 |

### Y. Behavioral analytics & personalization (added 2026-06-13)

| ID | Requirement | Pri |
|---|---|---|
| FR-BEH-01 | **Exhaustive first-party event/clickstream pipeline** — capture every meaningful interaction (page/product views, scroll depth, dwell time, hovers, searches + result clicks, filter use, cart add/remove, wishlist, checkout steps + drop-offs) stitched into a **per-customer journey/path** for behavioral & psychographic analysis. | P0 |
| FR-BEH-02 | Add **PostHog + Microsoft Clarity** (session replay + heatmaps) alongside the first-party pipeline; **consent banner + anonymized-until-consent** mode. | P0 |
| FR-PERS-01 | **Rule-based personalization engine** driven by views/purchases/declared preferences (ML/collaborative-filtering = Phase 2). | P0 |
| FR-PERS-02 | **Personalized homepage** with dynamic rows: **Recently viewed**, **Buy again**, **Recommended by goal**, **Because you viewed X**, **Popular in your tier**. | P0 |
| FR-PERS-03 | **Personalized search ranking** (uses history/preferences). | P0 |
| FR-PERS-04 | **Recently viewed** products surface (also a homepage row). | P0 |
| FR-PERS-05 | **"Frequently bought together" / "Customers also bought"** recommendation blocks (rule-based). | P0 |

### Z. Engagement, content & platform extras (added 2026-06-13)

| ID | Requirement | Pri |
|---|---|---|
| FR-PLAY-01 | **"Play" section** — quizzes + games for customers; **AI-generated quizzes** added to the section; basic gamification (badges/challenges) tie-in. | P0 |
| FR-QUIZ-01 | **Guided selling quiz** ("find your supplement / build your regimen") → recommends products. | P0 |
| FR-WSH-05 | **Multiple / named wishlists** + shareable + registries (extends wishlist E). | P0 |
| FR-REV-04 | **Review photos/videos** (customer-uploaded). | P0 |
| FR-REV-05 | **AI review summaries** per product. | P0 |
| FR-HEALTH-01 | **"How long will this last" duration calculator** (uses product size + daily dosage). | P0 |
| FR-REPL-01 | **Replenishment reminders** (consumption-based, using the duration data). | P0 |
| FR-PLAT-01 | **A/B testing / experimentation framework**. | P0 |
| FR-PLAT-02 | **Fraud detection** (orders/payments risk scoring). | P0 |
| FR-PLAT-03 | **PWA** — installable web app (offline-safe shell). | P0 |

> **Phase 2 (deferred, per your answers):** supplement **interaction/contraindication checker**,
> **pharmacist consultation booking**, **personalized regimen builder** (3 of the 4 health features);
> ML personalization/collaborative filtering; visual & voice search; subscriptions; native mobile app;
> AI shopping assistant.

---

## 7. Integration requirements (YeldnIN) — summary (full spec: `INTEGRATION_CONTRACT.md`)

| ID | Requirement |
|---|---|
| FR-INT-01 | HMAC service-to-service auth; feature-flagged; idempotent; outbox + retry. |
| FR-INT-02 | Veeey→YeldnIN: create restock/special request; push revenue events; create own-courier/UltraFast delivery job; product upsert by SKU. |
| FR-INT-03 | YeldnIN→Veeey: request.status_changed, special_order.milestone, **shipment.received (stock-in)**, delivery.status_changed. **No trip/traveler data in any payload.** |
| FR-INT-04 | SKU is the shared key; each lot retains source YeldnIN batchId for revenue/COGS attribution. |
| FR-INT-05 | Contract is **versioned**; **re-baselined against the latest YeldnIN description before execution** (expiry-capture location + any new fields reconciled then). Veeey can connect to YeldnIN at any time. |

## 8. Data & migration requirements (full detail: `MIGRATION_FINDINGS.md`)

| ID | Requirement |
|---|---|
| FR-MIG-01 | Migrate full catalog (2,739 products, all simple), generate SKUs, keep legacy ids. |
| FR-MIG-02 | Migrate **full** customer base (19,866; merge duplicate emails; seed tiers/points from order history). |
| FR-MIG-03 | Migrate **full order history** (all years/statuses); map pharmacist aliases → users; map statuses. |
| FR-MIG-04 | Migrate reviews (date-clamped), pages, **blog posts** (re-export), **full redirect set** (re-export). |
| FR-MIG-05 | Migrate live lots only; **write off ~840 expired lot records** before stock load; opening stocktake validates. |
| FR-MIG-06 | Pre-migration cleanup: brand normalization (718→~200), attribute dedupe, tag curation, city/area map, weight/SKU/draft triage, **Arabic MT pass**. |
| FR-MIG-07 | Re-export fresh data at cutover (checklist in findings §10). |

### Transition mirror — parallel Egypt Vitamins ↔ Veeey run (temporary)

| ID | Requirement | Pri |
|---|---|---|
| FR-MIR-01 | During a transition window, run **both** Egypt Vitamins (WooCommerce) and Veeey live with shared data. **Veeey is the single source of truth for inventory + orders** (prevents overselling). | P1 |
| FR-MIR-02 | A **mirror pipeline** keeps WooCommerce in sync: Woo **reads stock from Veeey** and **pushes any orders it takes into Veeey** (so stock decrements in one place); **products + customers** sync alongside. Bridges the differing DB schemas via the pipeline. | P1 |
| FR-MIR-03 | Built as an **isolated, feature-flagged, removable module** — not wired into Veeey's core. **Lifecycle:** ships **off** → turned **on only after Veeey testing is complete** → runs during transition → **cleanly decommissioned/removed after Egypt Vitamins is fully migrated**, leaving no residue. | P1 |
| FR-MIR-04 | Sync is observable (status, queue depth, conflicts, retries) with reconciliation reporting; idempotent; a sync failure must never corrupt Veeey's authoritative inventory/orders. | P1 |

## 9. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Performance/SEO**: SSR, fast Core Web Vitals, CDN images/WebP. |
| NFR-02 | **Security**: public/internal split; reCAPTCHA v3; WAF/rate-limiting; XSS/CSRF hardening; secrets mgmt; audit log; encrypted backups. |
| NFR-03 | **Availability/scale**: HA-capable; handles catalog of ~3k products, ~20k customers, public traffic spikes. |
| NFR-04 | **API-first**: web consumes the same documented API a future mobile app would reuse. |
| NFR-05 | **Maintainability**: modular; configurable rules (no hard-coding business numbers). |
| NFR-06 | **Privacy/consent**: marketing consent honored; one-click unsubscribe; data-export/erasure support. |
| NFR-07 | **Hosting**: Hetzner dedicated + CWP; Next.js under PM2+nginx; PostgreSQL on-box; automated backups. |
| NFR-08 | **Security hardening (launch program)**: WAF + bot/abuse protection (the storefront is attacked constantly); **pre-launch penetration test**; payment **idempotency + gateway tokenization** (PCI-light — never store cards); secrets management + rotation; dependency/vulnerability scanning in CI; rate-limiting on public + AI endpoints. |

## 10. Open decisions (none block build)

**Five configurable / build defaults** (a sensible default is seeded; fill in the exact value later):
1. ⚠️ UltraFast brand name.
2. ⚠️ Legacy "cheque" payment mapping (order migration).
3. ⚠️ Confirm RBAC role matrix (FR-RBAC-01).
4. ⚠️ Compensation late-windows + price-per-expiry discount bands (exact numbers).
5. ⚠️ Tier benefits matrix (per-tier hidden/discounted categories & tags).

**Two external / legal** (resolved outside the build, still non-blocking):
6. Restricted-item classification — which products to flag + which toggles to apply (business/legal call).
7. ⚠️ **Expiry-capture location** (YeldnIN vs Veeey) — settled against the latest YeldnIN description at the integration re-baseline (FR-INV-06 / FR-INT-05).

**Resolved this round:** AI write autonomy = **staged + human approval for high-impact** (FR-MCP-03);
**build the public AI content API + llms.txt** (FR-SEO-06); editable SEO/AEO fields on every entity,
API-writable (FR-SEO-07).

## 11. Glossary

**Lot** — stock of a product with one expiry at one location. **FEFO** — First-Expiry-First-Out.
**Price-per-expiry** — different price per expiry lot. **Special order** — buy any product from abroad
on request. **UltraFast** — 3–6h Cairo delivery. **Stock-in** — goods crossing YeldnIN→Veeey at
publish. **Gift (Gx-*)** — hidden 0-value promo item. **YeldnIN** — internal purchasing/logistics app.
**Tier** — Veeey Green / VeeeyIP / Veeey Select membership (renameable). **Restriction profile** — per-product compliance toggles.

---

## 12. Review sign-off checklist

Tick each as you confirm; note any change by requirement ID.

- [ ] §1–2 Vision & objectives
- [ ] §3 Scope & phasing (v1 vs Phase 2)
- [ ] §4–5 Actors & architecture
- [ ] A. Catalog & product management
- [ ] B. Inventory, lots, expiry, FEFO, price-per-expiry
- [ ] C. Pricing, tiers, loyalty, referrals, coupons
- [ ] D. Accounts & portal
- [ ] E–F. Wishlist & alerts, Compare
- [ ] G–H. Search & storefront (homepage/PDP/category)
- [ ] I–J. Cart, checkout, payments
- [ ] K–L. Shipping/couriers/UltraFast, Orders (incl. gifts, invoices)
- [ ] M. Special orders & compensation
- [ ] N. Stocktake
- [ ] O–P. Returns, Reviews
- [ ] Q–R. CMS/blog, SEO/feeds
- [ ] S–T. Notifications, Analytics
- [ ] U–W. RBAC, AI access (Claude & others), Restricted items
- [ ] X. Internationalization
- [ ] Y. Behavioral analytics & personalization
- [ ] Z. Engagement (Play/quizzes), content & platform extras
- [ ] §7–8 Integration (incl. transition mirror) & migration
- [ ] §9 Non-functional
- [ ] §10 Open decisions
