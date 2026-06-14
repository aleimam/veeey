# Veeey — Living Design Specification

> **Status:** v0.2 draft · 2026-06-13 · authoritative source of truth for the Veeey build.
> Update this file *before* changing direction; build against it; review changes here first.
>
> **Companion docs:** `MIGRATION_FINDINGS.md` (real-data analysis) · `VEEEY_INTEGRATION_PROMPT.md` +
> (YeldnIN repo) `INTEGRATION_CONTRACT.md` (the API contract) · `v0-export/` (locked homepage UI) ·
> v0 prompts 02–04 (homepage refinements, PDP, category).
>
> Legend: 🔒 decided · ⚠️ **Decision needed** · ⏭️ phase 2+.

---

## 1. Vision & business model

**Veeey** ("Health Inside", veeey.com) — a premium bilingual (AR/EN) B2C storefront for dietary
supplements and health devices imported directly from the **USA, UK & EU**, replacing
egyptvitamins.com. Audience: elite (A+++) Egyptian customers. Currency: **EGP only**.

Three ways to buy, one unified flow:
- **In stock** — sold from live lots, FEFO, with per-lot expiry shown everywhere.
- **Pre-order** — curated products not currently in stock (25% deposit).
- **Special order** — *any* product from abroad on customer request (25% deposit), with a
  **guaranteed deadline and automatic compensation if late**.

Differentiators the whole product must foreground: **expiry shown before you buy**, **price-per-expiry**
(same product, cheaper near-expiry lot), **special-order-anything with compensation**, **UltraFast
3–6h delivery** (Greater Cairo), **pharmacist-curated**, **loyalty + tiers**.

Scale (from live audit): 2,739 products (all simple), ~605 in stock, **19,866 customers**, ~500–1,000
orders/mo, **AOV ≈ 9,603 EGP**.

---

## 2. System architecture 🔒

**Two systems, two databases, one event-driven API.**

- **Veeey** — public storefront + admin. **Next.js (App Router) + Prisma + PostgreSQL.** Hosted on a
  **Hetzner dedicated server** alongside CWP; the Next.js app runs under **PM2 + nginx** (CWP is
  PHP-oriented and does not manage it), Postgres installed on the box, automated backups. API-first
  so a future mobile app reuses the same API.
- **YeldnIN** — internal purchasing/logistics/finance. Stays as-is (Next.js + SQLite, `in.yeldn.com`).
- **Boundary:** Veeey owns catalog, **live sellable stock + lots/expiry**, accounts, pricing, tiers,
  loyalty, orders, payments, revenue, stocktake, gifts, CMS, analytics. YeldnIN owns product
  **requests**, supplier purchasing, trips/travelers, receiving, finance/COGS, and the **Couriers**
  module (own-courier + UltraFast execution).
- **Why split:** public/internal security boundary; don't rewrite YeldnIN's working import engine;
  different runtime/scale needs; the seam is event-driven not chatty. (Full rationale in memory.)

### Ownership of stock — the baton model
Live sellable stock exists **only in Veeey**. YeldnIN never holds sellable inventory. Goods cross the
boundary once, at **stock-in** (YeldnIN `shipment.received` event → Veeey intake screen → Ops/Sales
record per-lot expiry + set price-per-expiry → publish to live catalog).

---

## 3. Integration with YeldnIN 🔒

Defined in `INTEGRATION_CONTRACT.md` (YeldnIN side, epic V built). Summary:

- **Auth:** HMAC-signed service-to-service (separate from human sessions). Feature-flagged
  (`INTEGRATION_ENABLED`), idempotent, outbox + retry dispatcher.
- **Shared key:** **SKU** (Veeey = catalog master; pushes product identity via `products/upsert`).
- **Veeey → YeldnIN:** create restock/special-order request; push `RevenueEvent`s (per-unit sales,
  many per batch); create courier `DeliveryJob` (own-courier/UltraFast).
- **YeldnIN → Veeey:** `request.status_changed`, `special_order.milestone` (feeds compensation math),
  **`shipment.received`** (stock-in: SKU, qty, photos, batch id — *no trip/traveler identity*),
  `delivery.status_changed`.
- **Golden Condition:** no trip/traveler data ever reaches Veeey/customers.
- **Revenue/COGS:** Veeey books revenue per sale; YeldnIN nets it against per-batch COGS it already
  stores. Each Veeey lot carries its originating YeldnIN `batchId` for attribution.
- **Versioned & re-baselined:** the contract is versioned; **before execution it is re-diffed against
  the latest YeldnIN description** (YeldnIN evolves independently — e.g. it may now capture per-item
  expiry lots at incoming shipments and send them via `shipment.received`). The **expiry-capture
  location** (YeldnIN vs Veeey intake, §5) is settled at that re-baseline. Veeey can connect anytime.

---

## 4. Core data model (Veeey / Postgres)

High-level entities (Prisma to be authored from this). FEFO/lot is the spine.

- **Product** — sku (generated), legacyWpId, name{en,ar}, slug{en,ar}, brandId, productTypeId,
  categories[], tags[], attributes{}, descriptions{en,ar}, images[], weightG, defaultSupplierHint,
  scope, **restricted** flag, seo{title,desc,jsonld} per locale, reviewsAggregate, status.
- **Brand**, **Category** (hierarchical, bilingual), **Tag**, **Attribute**/**AttributeValue**
  (governed schema).
- **Lot** — productId, **location**Id, **expiryDate**, qtyOnHand, qtyReserved, costEgp (from YeldnIN),
  **priceOverride?** (price-per-expiry), saleFlag, sourceBatchId (YeldnIN), receivedAt, status
  (LIVE/QUARANTINE/EXPIRED/WRITTEN_OFF).
- **Location** — name, type, ultraFastZone? (multi-location ready).
- **PriceRule** — base price on Product; tier modifiers; expiry/sale modifiers; coupon engine.
- **Customer** — email, phone, name{}, **tier** (Veeey Green/VeeeyIP/Veeey Select; renameable), pointsBalance,
  referralCode, referredById, addresses[], wishlist[], veeeyCustomerId↔YeldnIN, social identities,
  marketingConsent, segments.
- **Address** — structured governorate → city/area (no free text), default flags.
- **Order** — number, customerId, items[], lot bindings, status (see §10), paymentMethod, paymentState,
  depositPaid, balanceDue, pharmacistUserId, source, utm, payCheck, customerType, shippingMethod,
  courier, tracking, compensationApplied, gifts[], totals, timestamps.
- **OrderItem** — productId, **lotId** (bound lot → exact expiry travels through), qty, unitPrice,
  pointsEarned, isGift.
- **Lot reservation** — soft-hold at checkout with expiry.
- **Gift** (separate inventory) — code (Gx-*), internalName, stock, expiry?, costEgp.
- **WishlistItem** — customerId, productId, `notifyPriceDrop`, `notifyBackInStock`, addedAt.
- **CompareList** — sessionId/customerId, productIds[] (max 4). (Guests: client-side; members: persisted.)
- **ProductChangeEvent** — productId, type (PRICE_DROP / BACK_IN_STOCK / LOW_STOCK / SALE_LOT), oldValue,
  newValue, at — emitted on price/stock mutations; drives wishlist alerts + back-in-stock + analytics.
- **Coupon**, **LoyaltyTransaction**, **Referral**, **Review**, **Return**, **StocktakeSession** +
  **StocktakeCount**, **MovementLedger** (per lot/location), **CmsPage**, **BlogPost**, **Redirect**,
  **NotificationTemplate**, **AuditLog**, **AnalyticsEvent**, **User/Role/Permission** (RBAC),
  **IntegrationClient** (for the Claude MCP + YeldnIN).

---

## 5. Catalog, lots, FEFO & price-per-expiry 🔒

- Product page shows the **nearest-expiry** lot's date in listings; once a lot is selected/bought,
  **that lot's exact expiry follows the line item** through cart → checkout → order → invoice → emails.
- **FEFO:** default sale picks nearest-expiry lot of a location; reserved at add-to-cart (timed
  soft-hold; graceful auto-rebind + notice if it lapses).
- **Price-per-expiry:** a lot may be flagged Sale with its own price. System *suggests* short-expiry
  discounts from (stock level, 3-mo sales velocity, expected consumption duration = f(size, dosage));
  **pharmacist confirms**. Customer picks expiry option → price changes. Far-expiry purchased at full
  price reserves the far lot (not auto-FEFO).
- **Intake** (stock-in from YeldnIN): Ops/Sales screen to record per-lot expiry, confirm photos, set
  price-per-expiry, publish. Lots carry sourceBatchId for revenue/COGS attribution.
- **Multi-location** baked in now (one location today); stocktake & FEFO operate per location.

---

## 6. Pricing, tiers, loyalty, referrals, coupons 🔒

- **Tiers:** **Veeey Green → VeeeyIP → Veeey Select** (entry→top; **names admin-renameable**) —
  **assigned manually by staff**. Drive: **earn rate** (configurable, default 1/2/3 pts per EGP);
  **per-tier product-behavior rules** keyed by **category/tag/attribute** that differ **price,
  visibility, and/or availability** by tier; and **per-tier UI** = **theming** (tier colors/badge/hero
  accents/banners) **+ tier-specific merchandising** (featured products, collections, offers).
  Top-tier (Veeey Select): dedicated pharmacist ⏭️, members-only products/prices. Fully distinct
  per-tier page layouts ⏭️ P2. *(Note: the locked homepage's tier cards say Silver/Gold/Platinum —
  rename to Green/VeeeyIP/Select during build.)*
- **Loyalty:** earn by tier; **redeem 200 pts = 1 EGP**; bonus points for reviews; **expiry
  configurable, default never**. Points + coupons + tier discounts **stack**.
- **Referrals:** admin-configurable rule (default: inviter earns 100% of invitee's points year 1,
  50% thereafter); invitee welcome perk configurable.
- **Coupons:** advanced engine — %/fixed/free-item/min-spend/first-order/category- or tier-limited/
  single-use/expiry/stacking rules.

---

## 7. Customers & accounts 🔒

- Accounts with: order history, ongoing-order + special-order tracking (visual timeline), addresses
  (structured), saved payment methods, **wishlist** (with price-drop + back-in-stock alerts),
  **product compare**, quick reorder, profile, points balance +
  redemption, tier badge, referrals. Personalized portal that adapts to tier visuals.
- **Login:** email/password + social (Google, Meta, Apple, X) + guest checkout. reCAPTCHA v3.
- **Migration:** passwords not portable → existing customers set new password via email or use social.
- **Arabic catalog 🔒:** **machine-translate all ~2,200 untranslated products** for a full bilingual
  launch; **pharmacist reviews the medical content** (descriptions/usage/dosage) of the live subset
  (~600 in-stock + bestsellers) **before launch**; long tail reviewed on a rolling basis. Structured
  attributes translate safely; medical claims get human review. (Migration adds an MT pass — §22.)

---

## 8. Storefront UX

- **Homepage 🔒 LOCKED** — design in `v0-export/`; Withings-style restraint + Veeey brand. Sections:
  announcement bar → header (search) → product-first hero → 3 category cards → trust strip →
  shop-by-goal → bestsellers (expiry chips, ratings, points, short-expiry/pre-order badges,
  wishlist) → price-per-expiry selector → special-order journey (dark) → tiers → testimonials →
  footer + floating WhatsApp.
- **PDP** (v0 prompt 03): zoom gallery, inline price-per-expiry lot selector, tier price + points,
  three stock states (in-stock / pre-order-25%-deposit / out-of-stock notify), specs table, reviews,
  related + cross-sell, sticky mobile add-to-cart.
- **Category/listing** (v0 prompt 04): instant multi-select filters (goal/brand/form/concern/
  certifications/price), in-stock/offers/pre-order toggles, sort (incl. nearest expiry), grid reusing
  ProductCard, special-order empty-state.
- **Wishlist 🔒:** add from card/PDP. Per-item alerts — **price-drop** (effective price falls past a
  configurable threshold, e.g. ≥5%, via new short-expiry/Sale lot, regular-price cut, or tier-price
  change) and **back-in-stock** (out→in when a new lot publishes). Alerts fan out from
  `ProductChangeEvent`s to opted-in wishlisters through the email/SMS/WhatsApp adapter, with
  frequency cap (≤1 price alert / product / customer / N days), once-per-restock, and consent/opt-out.
  Powers the PDP "Notify me" button too.
- **Compare 🔒:** add up to **4** products (card/PDP toggle); sticky compare bar; comparison page shows
  side-by-side columns with rows aligned by the governed attribute schema (Size, Form, Servings, Conc,
  Ingredients, origin, certifications…) + image, brand, tier price, rating, expiry, categories, tags,
  stock state, add-to-cart; missing values "—"; optional difference highlighting; mobile horizontal
  scroll. Client-side for guests, persisted for members.
- **Search:** advanced, typo-tolerant, **Arabic-aware**, via a **dedicated engine (Typesense/Meilisearch)**
  (not Postgres FTS) for catalog scale + personalized ranking; across products/brands/tags/categories/attributes; logs queries
  + zero-result + outcomes; search-performance dashboard. (FiboSearch is the current benchmark.)
- **Brand/voice:** greens #48884D/#38764D, lime #D1D725, gold #FFC000 (stars/short-expiry only),
  slate #33424F, surface #F4F6F3; Poppins (Latin) + Cairo (Arabic); premium editorial; eyebrows;
  generous whitespace; real product photography (key investment).

---

## 9. Cart & checkout 🔒

- Multi-step, mobile-first, guest checkout, editable checkout fields (admin).
- Lot binding + timed soft-reservation; expiry shown per line.
- **Upsell/cross-sell:** related-product blocks across the journey — **product page + cart + checkout**
  — from each product's related list (manual or AI-set). (FR-CAT-04.)
- **Deposit mode:** pre/special orders charge **25% deposit**, balance on delivery; compensation
  discount applies to the balance.
- **Payments:** OPay, Kashier (admin orders the list, cheaper first), COD, POS-on-delivery, bank
  transfer, mobile wallet. Gateway webhooks confirm payment. ⚠️ Verify legacy "cheque" payment label
  (484 orders) maps to which method.
- **Shipping (Egypt only):** standard **"Fast & Free" is free** (absorbed); premium types carry fees.
  A **Shipping Zones** admin map — hybrid granularity
  (area/district in Greater Cairo, governorate elsewhere) — defines per area the available **shipping
  types + ETA**, UltraFast eligibility, and courier mapping (Aramex/SMSA/own → feeds Ops suggestion).
  Three customer types (fees configurable): **"Fast & Free"** = 0 EGP (ETA varies by address),
  **UltraFast** = 400 EGP (3–6h eligible areas), **Pick from Office** (click & collect) = 100 EGP.
  A **"Deliver to [area]" selector** shows types + ETA on product page / cart / checkout +
  a public Shipping Info page; ETA blends with stock state (in-stock → area window; pre/special →
  SLA + area window). Ops assigns courier per order. (FR-SHP-06/07/08.)
- No VAT/tax. reCAPTCHA on checkout.

---

## 10. Orders & fulfillment 🔒

- **Status vocabulary (from live data — 11):** Pending Confirmation, Processing, Hold, Shipped,
  Cash Delivered, Card Delivered, Cancelled, Refunded, Failed, + working states Draft/Edit.
  Customer-facing timeline simplifies to: Placed → Processing → Shipped → Delivered.
- **Event-driven progression** (e.g. add AWB/tracking → Shipped) + manual overrides.
- **Order editing in Hold:** add/remove items with real-time correct-lot stock updates.
- **Admin order list columns:** Pharmacist, Pay Check (No/Yes/Problem), Tracking, Order Source.
  **Order metadata:** Customer Type (Discount Chaser/Doctor Recommended/Sales Advice/Self Ordering),
  Product Type tag (Miscellaneous/Male Support/Premium/New/Trend) — admin-editable lists.
- **Pharmacist** recorded per order + on invoice (migration maps free-text aliases → User accounts).
- **PDF invoice** with pharmacist name + per-line expiry + per-line weight; editable templates.
- **Fulfillment routing:** Aramex/SMSA via carrier APIs (Veeey direct); **own-courier + UltraFast →
  YeldnIN Couriers module** (delivery job out, status back).
- **Gifts:** staff manually add 0-value code-named gifts (Gx-*) from separate gift inventory; **hidden
  from customer everywhere**, visible on internal packing slip; cost booked as promotional expense.
- **Export:** orders/customers/products to Excel with selectable date range + columns.

---

## 11. Stocktake / physical inventory module 🔒

Monthly-named sessions, per location, multi-day/phase, chunked by category/tag/brand, global coverage
meter. **Phase 1 Forward** (products with stock > 0; per-lot inline adjust; add/fix expiry; green
label; posts live immediately; expected = live + Hold/Processing reservations; **sales net-out by
timestamp** to kill mid-count errors; visible counting + variance highlight + reason codes).
**Phase 2 Reverse** (register physical items not in system). Uncounted at close → flagged, never
zeroed. Immutable snapshot + **per-lot/location movement ledger** (powers reconstruction: last count −
dispatched + arrived). PDF/XLSX export.

---

## 12. Returns & refunds 🔒

Customer-initiated return request in the portal; **returned stock → quarantine** for pharmacist review
(re-shelf to correct lot or write off — never auto-resell). Refund via the system; **COD orders
refunded by bank transfer**; option to refund as store credit/points.

---

## 13. Special orders & compensation 🔒

Customer requests any product → creates a YeldnIN request (25% deposit) → YeldnIN purchasing/import →
`shipment.received` → fulfilled. Deadline from product-type/supplier SLA (e.g. Fast 20d / Manufacturer
30d / Injection 40d). **Compensation computed in Veeey** from configurable late-windows (e.g. 1–10d
late → 5%, …), applied to the customer's balance, using milestone timestamps YeldnIN emits. Customer
sees a live special-order tracker.

---

## 14. Content: CMS, blog, reviews, SEO/AEO 🔒

- **CMS pages** (bilingual) for policies, About, FAQ — addable anytime.
- **Blog** (Medical Blog) — migrate 81 posts (⚠️ need fresh export). Marked up for citability.
- **Reviews:** native product reviews on Veeey (+ import ~1,028, clamp bad dates) with rich-snippets;
  display live **Trustpilot** rating widget; bonus points for reviews.
- **SEO/AEO:** SSR, per-locale URLs (`/en`,`/ar`) + hreflang + canonicals, **301s from full Rank Math
  set** (⚠️ re-export — current file capped at 1,000), **JSON-LD** (Product/Offer/AggregateRating/
  Brand/Breadcrumb) everywhere, sitemaps, llms.txt, editable per-entity meta (migrate Rank Math
  focus keywords/descriptions). Google Merchant + Meta Catalog product feeds.
- **AEO (AI-engine optimization):** a **public AI-readable content API/feed** (authoritative structured
  JSON/markdown of catalog + content) + `llms.txt` so ChatGPT/Perplexity/Gemini ingest & recommend
  Veeey accurately; **every entity** carries editable AEO fields (AI summary, FAQ, structured-data
  overrides, keywords) per locale, **writable via the admin API** (humans now, Claude later).

---

## 15. Notifications & templates 🔒

Provider-agnostic adapters for **Email + SMS + WhatsApp**. Event → channel matrix (placed, paid,
shipped, delivered, special-order milestones, compensation, **wishlist price-drop**, **back-in-stock**,
review request, abandoned cart) — wishlist alerts honor per-item flags + frequency caps (§8). All templates (PDF invoice, on-screen invoice, emails, SMS, WhatsApp) **editable from the
dashboard**, bilingual, with merge variables. Floating WhatsApp + phone-call buttons sitewide.

---

## 16. Analytics & dashboards 🔒

**First-party** analytics (owned data) + a **self-serve report/chart builder** (compose any graph,
compare any figures/periods, segment, export) + a large pre-built dashboard catalog spanning Sales,
Customers (RFM/cohorts/LTV/retention/tiers), Products & inventory (incl. **expiry aging**), Loyalty,
Marketing/attribution (source/UTM/referrer; Google/Meta connectors), Fulfillment (courier perf,
**UltraFast SLA**), Special orders (deadline adherence, compensation paid), Search & behavior.
Complemented by GA4 + Meta Pixel/CAPI (server-side). Full audit/history on everything; session/source
tracking per user/session/order; visitor location + referrals.

---

## 17. RBAC — draft role matrix ⚠️ (review & edit)

Admin-configurable permission system. Proposed default roles (edit freely):

| Role | Scope |
|---|---|
| **Super Admin** | Everything incl. settings, RBAC, finance, Claude MCP scope. |
| **Admin** | All operational modules; not RBAC/system settings. |
| **Pharmacist (Sales)** | Catalog view, orders (create/edit, assign self), intake/price-per-expiry, special orders, customers, reviews moderation. |
| **Operations** | Orders + fulfillment + delivery assignment + stocktake + packing/gifts. No pricing/finance. |
| **Content/SEO** | CMS pages, blog, products' content/SEO/images, collections, theming. No orders/customers. |
| **Marketing** | Coupons, campaigns, analytics, feeds/attribution, tiers (assign), loyalty config. |
| **Finance** | Revenue/refunds/reports, exports. Read orders. |
| **Courier** | (Mostly YeldnIN Couriers module) own delivery jobs + status. |
| **Customer Support** | Orders read + notes, returns processing, customer profiles. |

Each section keeps its own permission keys; visibility/data scoped per role.

---

## 18. AI access — Claude & other models (read + write) 🔒

- **Model-agnostic admin API** (REST + OpenAPI) over scoped keys/OAuth + an **embedded MCP server**
  wrapping it (native Claude/MCP-agent access). One API, two front doors.
- Governed by the **same RBAC** as humans (AI = a role). **Reads freely + drafts/stages writes**;
  **high-impact actions** (publish live, change live prices, send customer messages, refunds) require
  **human approval**; autonomy grantable per capability over time.
- Every AI action **audit-logged**, rate-limited, attributable, reversible where possible.
- Scope spans read intelligence (analytics Q&A), content/catalog management, **SEO/AEO field writes**
  (enables later Claude-driven optimization), and operational actions within permissions.

---

## 19. External integrations 🔒

- **Payments:** OPay, Kashier (+ webhooks, refunds). COD/POS/bank/wallet.
- **Shipping:** Aramex API, SMSA API, own couriers (YeldnIN Couriers module).
- **Marketing:** Google Merchant Center + Google Ads + Search Console; Meta Pixel + **Conversions
  API**; GA4. Product feed generator (XML/CSV, bilingual).
- **Messaging:** WhatsApp Business API + SMS gateway (provider chosen at build, adapter-based).
- **Reviews:** Trustpilot (display) + Google Business.
- **Security:** reCAPTCHA v3, WAF/rate-limiting, standard XSS/CSRF hardening.
- Adapter pattern so "many other services" plug in without surgery.

---

## 20. Internationalization 🔒

Full **AR + EN** on every page; RTL mirroring for Arabic; per-locale URLs + hreflang; Poppins/Cairo;
EGP formatting; structured bilingual addresses. (Translation-coverage decision in §7.)

---

## 21. Security & compliance 🔒

- Public/internal split (Veeey ≠ YeldnIN DB). Secrets management + rotation, backups, audit log.
- **Launch security program (NFR-08):** WAF + bot/abuse protection; **pre-launch pen-test**; payment
  **idempotency + gateway tokenization** (PCI-light, never store cards); dependency scanning in CI;
  rate-limiting on public + AI endpoints.
- **Restricted-item profile 🔒** — each product can be flagged, and a flagged product carries a
  **configurable set of restriction toggles**, each independently switchable per product at any time:
  hide from public catalog · hide from Google/Meta feeds · disable card payments (force COD/bank/
  wallet) · require login · gate by tier · require age/consent acknowledgment. **Default = no
  restrictions** (flagged items sell normally) until the business applies toggles after legal review.
  Admin can set/change these per product anytime. (Legal classification of which items = business call.)

---

## 22. Migration plan

Detailed in `MIGRATION_FINDINGS.md`. Phases:
1. **Cleanup (pre-migration):** brand normalization (718→~200), attribute schema + value dedupe, tag
   curation, city/area map, pharmacist→User aliases, expired-lot write-off (~840), weight/SKU/draft
   triage, and the **Arabic MT pass** (machine-translate ~2,200 products → pharmacist-review the live
   subset's medical content before launch, tail rolling — §7).
2. **Fresh re-export at cutover** (checklist §10 of findings — esp. full orders, full redirects,
   blog posts).
3. **Transform & load:** generate SKUs (keep wpId/legacySku), load products+content+SEO, lots (live
   only), customers (merge dup emails; seed tiers/points from order history), orders (status-mapped),
   reviews (date-clamped), redirects, pages/posts.
4. **Validate:** opening **stocktake** in Veeey establishes true stock; spot-check redirects, prices,
   bilingual coverage; integration smoke test with YeldnIN.
5. **Cutover:** DNS, 301s live, monitoring.

### 22a. Transition mirror (parallel Egypt Vitamins ↔ Veeey) — temporary, removable
For a transition window both sites run live on shared data. **Veeey is the single source of truth for
inventory + orders** (avoids the dual-master overselling trap). A **mirror pipeline** keeps WooCommerce
in sync — Woo reads stock from Veeey and pushes its orders into Veeey; products + customers sync
alongside; the pipeline bridges the differing schemas (Woo REST/webhooks ↔ Veeey API). Built as an
**isolated, feature-flagged, removable module** (not wired into core). **Lifecycle:** ships off → on
only after Veeey testing completes → runs during transition → **cleanly decommissioned after full
Egypt Vitamins migration**, no residue. Observable + idempotent; a sync failure never corrupts Veeey's
authoritative data. (PRD FR-MIR-01..04.)

---

## 23. Phased roadmap

- **v1 (launch):** full commerce, lots/FEFO/price-per-expiry, tiers/loyalty/referrals/coupons,
  accounts/portal, checkout/payments, orders/fulfillment, special orders + compensation, stocktake,
  returns, gifts, reviews/wishlist, CMS/blog/FAQ, search, SEO/AEO + feeds, notifications/templates,
  first-party analytics + builder, RBAC, Claude MCP, integrations, AR/EN, migration.
- **Phase 2+ ⏭️:** AI Health Assistant, gamification, NFC loyalty cards, predictive replenishment,
  subscriptions, full visual page-builder, dedicated-pharmacist concierge, the broader
  Suggestions/Insights engine (what to reorder/discount/advertise, tier moves), 2nd location,
  mobile app, GTIN backfill, barcode stocktake.

---

## 24. Open decisions

**Resolved 🔒:** Arabic = MT-all + review live subset (§7); Restricted-item *mechanism* = configurable
per-product restriction profile, default off, set after legal review (§21).

**Still open — five configurable / build defaults** (a sensible default is seeded; none block the build):
1. ⚠️ **UltraFast brand name** (placeholder until chosen).
2. ⚠️ **Legacy "cheque" payment** — which real method it maps to (wallet? POS?) for order migration.
3. ⚠️ **RBAC matrix** (§17) — confirm/edit the draft roles & scopes.
4. ⚠️ **Compensation windows** + **price-per-expiry discount bands** — exact numbers (or "configurable,
   fill in later").
5. ⚠️ **Tier benefits matrix** — exact per-tier hidden/discounted categories & tags.

**Plus two external / legal** (resolved outside the build, still non-blocking):
6. **Restricted-item classification** — which products to flag + which toggles to apply (business/legal call).
7. ⚠️ **Expiry-capture location** (YeldnIN vs Veeey) — settled at the integration re-baseline (§3, FR-INV-06 / FR-INT-05).
