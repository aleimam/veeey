# Veeey — WooCommerce → Veeey Field Mapping (egyptvitamins.com)

**Status:** PROPOSAL for owner sign-off. No code, no writes until this is approved.
**Companion:** `MIGRATION_FINDINGS.md` (source data analysis). **Source:** WooCommerce REST API
(`wc/v3`) + ATUM/WP exports for the parts the WC API doesn't expose.

## Legend
- ✅ **map** — copies across (maybe a simple format change).
- ⤵ **transform** — converted/normalized into a different Veeey shape.
- 🔑 **dedupe key** — used to match/avoid duplicates on re-run (`legacyWpId` / `legacySku` / `legacyId`).
- ✖ **dropped** — not stored as a column, **but the full original record is retained as raw JSON**, so nothing is lost (recoverable later).
- ⚠ **gap** — Veeey needs it, WooCommerce has no source → default + review flag (never invented business numbers).

## Safety model (how "are we safe?" is answered)
1. **This sheet is approved before any write.** Nothing imports until you sign off the mappings + open decisions below.
2. **Dry-run first** (P15 ETL): runs every transform against the real data and reports counts, samples, unmapped fields, validation failures, and gaps — **writes nothing**. Iterate until clean.
3. **Raw payload retained** per record → ✖ "dropped" is never "gone".
4. **Idempotent upserts keyed on `legacyWpId`** → re-runnable, no duplicates.
5. **Staged + reversible** → products land as `PRIVATE`/draft, expired lots quarantined; you review in Veeey, then publish. Veeey data is only added-to or matched-by-legacy-id, never destructively overwritten.
6. **zod validation** on every transformed record → bad/missing data is reported, not silently saved.
7. **Fresh export at cutover** — the real run uses a same-day export (data changes daily).

---

## 1. Products  (`wc/v3/products` → `Product` + `ProductImage` + relations)
| WooCommerce | → Veeey | Bucket | Notes |
|---|---|---|---|
| `id` | `legacyWpId` | 🔑 | match key |
| `sku` | `legacySku` | ✅ | original kept for traceability |
| *(generated)* | `sku` | ⤵ | new Veeey SKU (existing SKU helper); WC SKUs are meaningless numeric WP IDs |
| `name` | `nameEn` | ✅ | |
| *(WPML / none)* | `nameAr` | ⚠ | only ~18% have Arabic → translate-at-import (review) or partial |
| `slug` | `slugEn` | ✅ | `slugAr` ⚠ generated from `nameAr` |
| `status` (publish/draft) | `status` (PUBLISHED/PRIVATE) | ⤵ | import as PRIVATE first if you want a review gate |
| `description` | `longDescEn` | ✅ | HTML kept; `longDescAr` ⚠ |
| `short_description` | `shortDescEn` | ✅ | `shortDescAr` ⚠ |
| `regular_price` | `basePricePiastres` | ⤵ | float EGP → integer piastres (×100) |
| `sale_price` | `Lot.priceOverridePiastres` + `saleFlag` | ⤵ | Veeey sale lives on the **lot** (price-per-expiry), not the product |
| `weight` | `weightG` | ⤵ | store unit → grams (⚠ confirm kg vs g); ~689 missing → gap |
| `dimensions` | — | ✖ | Veeey has no dimensions field (retained raw) |
| `categories[]` | `Category` (ProductCategories) | ⤵ | via normalized map; **max 4/product** (Veeey rule) |
| `tags[]` | `Tag` (ProductTags) | ⤵ | curate the 1,870-tag sprawl |
| `attributes[]` | `Attribute`/`AttributeValue` | ⤵ | governed schema; dedupe near-dupes + typos |
| `images[]` | `ProductImage` | ⤵ | **download + re-host to CDN** (~13.8k URLs); url/alt/sortOrder/isPrimary |
| `meta_data` (Rank Math) | `metaTitleEn`/`metaDescEn` | ⤵ | extract the SEO keys only |
| `global_unique_id`/GTIN | `gtin` | ✅ | ~6% present |
| `upsell_ids` / `cross_sell_ids` | `ProductRelation` (UPSELL/CROSSSELL) | ⤵ | resolved via legacyWpId |
| `stock_quantity` / `stock_status` | *(not product-level)* | ⚠ | Veeey stock = **Lots**; real stock comes from the ATUM export, not WC (see §6) |
| `date_created` | `createdAt` | ✅ | |
| `kind` (Supplement/Device/Injection) | `kind` | ⚠ | WC has no equivalent → derive from category, or manual pass |
| `servingsPerUnit` / `dailyDosage` | duration-calc fields | ⚠ | from attributes if present, else blank |
| `related_ids`, `tax_*`, `shipping_class`, `virtual`, `downloadable`, `featured`, `catalog_visibility`, `reviews_allowed`, `purchasable`, `total_sales` | — | ✖ | dropped (retained raw); Veeey computes related/ratings itself |

---

## 2. Customers  (`wc/v3/customers` → `Customer` + `User` + `Address`)
| WooCommerce | → Veeey | Bucket | Notes |
|---|---|---|---|
| `id` | `Customer.legacyWpId` | 🔑 | match key |
| `email` | `User.email` | ✅ | |
| `first_name` / `last_name` | `firstName` / `lastName` | ✅ | `nameAr` ⚠ |
| `username` | `User.username` | ✅ | |
| `billing.phone` | `User.phone` | ⤵ | normalized to `2010…` |
| `billing.{address_1/2,city,state,postcode,country,company}` | `Address` (governorate/city/area/street/building) | ⤵ | **city is free text → normalize to courier governorate/zone** (⚠ mapping) |
| `shipping.{…}` | second `Address` | ⤵ | only if it differs from billing |
| `date_created` | `Customer.createdAt` | ✅ | |
| **password** | — | ✖ | **cannot migrate** (WC phpass hashes). Migrated users sign in via reset / OTP / social. `User.passwordHash` left null |
| `meta_data`, `is_paying_customer`, `avatar_url`, `role` | — | ✖ | dropped (retained raw) |
| `tierId` | entry tier (or by spend) | ⚠ | decision below |
| `pointsBalance` | `0` (or computed) | ⚠ | decision below |
| `referralCode` | *(generated)* | ⚠ | each customer gets a fresh code |
| `marketingConsent` | from newsletter meta if present, else `false` | ⚠ | |

---

## 3. Orders  (`wc/v3/orders` → `Order` + `OrderItem`)
| WooCommerce | → Veeey | Bucket | Notes |
|---|---|---|---|
| `id` | `legacyWpId` | 🔑 | match key |
| `number` | `number` | ✅ | keep WC number for continuity |
| `status` (+ custom statuses) | `OrderStatus` | ⤵ | per-status map (⚠ custom statuses need decisions) |
| `customer_id` | `customerId` | ⤵ | resolved via Customer.legacyWpId; `0` → `guestEmail` |
| `currency` | assert **EGP** | ✅ | reject/flag non-EGP |
| `total` | `totalPiastres` | ⤵ | ×100 |
| `discount_total` / `shipping_total` | `discountPiastres` / `shippingPiastres` | ⤵ | subtotal from line items |
| `payment_method`(_title) | `paymentMethod` | ⤵ | map COD / card |
| `billing` + `shipping` | `shippingAddressJson` (snapshot) | ⤵ | immutable snapshot |
| `line_items[]` | `OrderItem` | ⤵ | `product_id`→`productId` (via legacyWpId), `quantity`→`qty`, `price`→`unitPricePiastres` (×100) |
| `line_items[].lot/expiry` | `OrderItem.lotId` / `lineExpiry` | ⚠ | **no historical lot binding in WC** → null (acceptable for history) |
| `date_created` | `placedAt` | ✅ | |
| `coupon_lines` | `CouponRedemption` | ⤵ | resolved, or drop for history |
| `refunds`, `fee_lines`, `tax_lines`, `meta_data` | — | ✖ | dropped (retained raw); refunds → `Return` is a decision |
| `paymentState`/`payCheck`/`shippingType`/`courier`/`riskScore` | derived / blank | ⚠ | historical unknowns |

---

## 4. Taxonomy & reviews (supporting)
- **Categories** (`products/categories` → `Category`): `name`→`nameEn`, `slug`→`slug`, `parent`→`parentId` (resolved), `description`→`descriptionEn`, `image`→`imageUrl`. `nameAr` ⚠. (~53 paths.)
- **Tags** (`products/tags` → `Tag`): `name`→`nameEn`, `slug`→`slug`. Curate 1,870 → governed list. `nameAr` ⚠.
- **Attributes** (`products/attributes` + per-product → `Attribute`/`AttributeValue`): `name`→`key`/`nameEn`, `options`→`valueEn`. Dedupe near-dupes/typos. `nameAr`/`valueAr` ⚠.
- **Reviews** (`products/reviews` → `Review`): `id`→`legacyId` 🔑, `product_id`→`productId` (resolved), `reviewer`→`authorName`, `reviewer_email`→match `customerId`, `rating`→`rating`, `review`→`body`, `status`(approved)→`APPROVED`, `date_created`→`createdAt`. WC has **no review title** → `title` blank. (~1,028.) Product `ratingAvg`/`ratingCount` recomputed after import.
- **Coupons** (`products`→ no; `coupons` → Veeey coupon model): `code`/`discount_type`/`amount`/usage limits/`date_expires` → Veeey coupon fields. Decision: import active coupons only.

## 5. Not available via the WooCommerce core API (separate channel)
- **ATUM lots & expiry → `Lot`** — the inventory spine (stock = product × expiry × location). Comes from the ATUM export / WP API, **not** WC `stock_quantity`. ~3,000 lot rows; ~840 already expired → **quarantine on import**. This is the biggest non-WC item.
- **Blog posts / CMS pages** — WP REST (`wp/v2/posts`, `pages`).
- **Redirects** — WP/Rank Math export.

## 6. Open decisions (need your sign-off)
1. **Product `kind`** (Supplement / Device / Injection) — derive from category, or a manual pass?
2. **Arabic gap** — machine-translate at import (pharmacist review) vs launch partial AR?
3. **Brand normalization** — canonical brand map (718 polluted → ~150–250).
4. **Tag / attribute curation** — governed lists.
5. **Customers** — import all (incl. ~56% never-ordered) or active-only? Starting **tier**? Starting **points** (0 vs computed from history)?
6. **Order status map** — including WC custom statuses; treat `refunds` as Veeey `Return`s?
7. **Historical orders** — accept no lot binding (`lineExpiry` null)?
8. **Stock source at cutover** — confirm Lots come from the fresh ATUM export, not WC.
9. **Import gate** — products land `PRIVATE`/draft for review before publish? (recommended)
10. **Images** — re-host ~13.8k images to which CDN/storage?

---
*Next after sign-off: build the importers per entity → run the dry-run report → review → staged import (draft) → publish. All idempotent via `legacyWpId`, all reversible.*
