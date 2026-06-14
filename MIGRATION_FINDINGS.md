# Veeey — Migration & Data Findings Report

**Date:** 2026-06-11 · **Source:** egyptvitamins.com exports in `C:\Claude\eCommerce\Imports\`
**Purpose:** ground the Veeey design & migration plan in the real data. Analysis only — nothing was imported. All exports must be **re-run fresh at cutover**; numbers below describe the 2026-06-10 snapshot.

---

## 1. Executive summary

| Domain | Verdict |
|---|---|
| **Catalog (2,739 products)** | Migratable. All simple products (no variants!). Rich content & SEO meta. Needs SKU regeneration, brand/attribute normalization, and a translation pass (Arabic coverage only ~18%). |
| **Lots/expiry (ATUM)** | Model proven, data real (≈3,000 lot rows, BBE 2023–2035) but **~25–30% of lot records are already expired** — write-off/cleanup before migration. |
| **Customers (19,866)** | Nearly 2× the 10k estimate. 17,241 distinct emails; 56% never ordered. City field is free text — must be normalized for courier zones. |
| **Orders** | Export provided covers Jan 2025–Jun 2026 only (5,707 rows, seemingly delivered-only). **AOV 9,603 EGP** — confirms premium positioning. Full-history export needed at cutover. |
| **Reviews (1,028)** | Clean enough to import; minor date/score anomalies. |
| **Redirects** | Export contains exactly **1,000 rules — looks truncated** (dashboard reports ~2,000). Re-export required. |
| **CMS content** | 60 pages ✅, custom order statuses ✅. **Blog posts missing** from exports; the 282 MB XML is ~18k email-notification log entries (junk). Re-export Posts only. |

**No blockers found.** The biggest work items are data hygiene (brands, attributes, cities, expired lots) and the Arabic translation gap.

---

## 2. Catalog — 2,739 products

**Structure**
- Types: **2,720 simple**, 11 downloadable, 8 virtual. **Zero variable products / variations** → Veeey's product model can stay simple (product × lots); no variant migration needed. (Earlier guess of "597 variations" was wrong — that ATUM figure was controlled/uncontrolled split.)
- Published: 2,658 (81 drafts). All `visible` in catalog.
- **Languages: only 501 products have Arabic names (~18%)** → WPML translation coverage is low. Decision needed: machine-translate the rest at migration (with pharmacist review) or launch with partial AR catalog. *This is the single largest content-work item.*

**Identifiers**
- SKU: 2,717 present / 22 missing / **29 duplicated** / **2,675 are numeric WordPress IDs** → current SKUs are meaningless. Plan: **generate proper Veeey SKUs** for all products at migration, keep `legacySku`/`wpId` columns for traceability. (Matches the decided auto-SKU feature.)
- **GTIN/barcode: only 163 products (6%)** → gap for Google Merchant Center quality and future barcode stocktake. Backfill program recommended post-launch.

**Commerce data**
- Price present: 2,669 (range **6 → 439,879 EGP**). Sale price set: 261.
- In stock: 605 products, **2,528 total units**.
- Weight present: 2,050 → **689 missing** (needed for invoices per business rule + courier).

**Content & SEO**
- Images: 2,712 products with images, **avg 5.1/product ≈ ~13,800 image URLs** to download & re-host (CDN) at migration.
- Long description: 2,300 · short description: 2,435 → strong content base.
- Rank Math: 1,578 focus keywords, 1,557 meta descriptions → migrate into Veeey's per-entity SEO fields.
- Manual merchandising: 406 upsells, 518 cross-sells → migrate into Veeey's related-products overrides.

**Taxonomy health**
- Categories: 53 distinct paths; weight concentrated in Health & Wellness Goals (2,898 assignments), Public Health (680), Personal Care & Beauty (284).
- **Brands: 718 "distinct" values — heavily polluted** (case/spelling variants: "now"/"NOW"/"NOW®", "Dr Berg's"/"Dr. Berg", "Nature's Craft"/"Natures Craft"). Realistic true count ~150–250. **Normalization map required** (top: Solgar 95, now 94, Dr Berg's 91, NutriCost 70, Nusapure 69).
- **Tags: 1,870 distinct** → sprawl; recommend curating to a governed list during migration (tags drive tier rules + collections in Veeey, so they must be meaningful).
- Attributes: 8 core attributes carry the catalog (Size 1,208 · Age & Gender 1,184 · Imported from 1,132 · Ingredients 994 · Servings 924 · Unit 824 · Conc 642 · Brand 172) plus a ~40-attribute device long-tail **full of near-duplicates** ("Technology" vs "Technology Type", "Wavelength" vs "Wavelengths", singletons). Migration maps these to a governed attribute schema; values also need dedupe ("Vegeterian", "Wipse" typos).

---

## 3. Lots & expiry (ATUM Multi-Inventory, 12 PDF reports)

- Reports cover 12 categories: **3,034 items, 643 in stock** (sums of per-report resumes).
- ≈**3,000 lot rows** carry dates (estimate — PDF parsing mixes Inventory Date & BBE columns; treat ±10%).
- **BBE year distribution:** 2023: 107 · 2024: 236 · 2025: 301 · 2026: 556 · 2027: 903 · 2028: 754 · 2029: 113 · 2030: 23 · outliers (2031, 2035 — likely typos).
- 🚩 **~644 lots have BBE in 2023–2025 (already expired) + 199 more expired Jan–May 2026 → roughly 840+ expired lot records still present.** Mostly zero-stock rows kept for history, but any with stock must be written off / quarantined **before** migration so Veeey opens with truthful FEFO data.
- Structure confirms the Veeey lot model 1:1: per-lot expiry + stock + (sparse) price/purchase-price. Lot names are the expiry label ("DEC 2028"); LOT/Batch field unused; per-lot sale pricing rarely used → **price-per-expiry is effectively a new capability**, not migrated history.
- Purchase prices in ATUM are unreliable placeholder values (e.g. 30 EGP cost on a 4,950 EGP product) → **do not migrate costs**; real COGS flows from YeldnIN going forward.

**Migration approach:** lots for the ~605 in-stock products migrate (product, expiry, qty); the long expired/zero tail archives into a history table, not live inventory. First Veeey **stocktake session right after go-live** validates opening stock.

---

## 4. Customers — 19,866 records

- **~2× the working estimate of 10k.** 18,450 with email; **17,241 distinct** (1,209 shared/duplicate emails → merge candidates).
- **8,799 (44%) have ≥1 order; 55.7% never ordered** (newsletter/abandoned signups). Recommendation: migrate all, but tier/loyalty seeding only from purchase history.
- Lifetime recorded spend: **97.7M EGP**. Signups span Apr 2020 → Jun 2026.
- 4,250 Arabic-script names (mixed-language base confirmed).
- 🚩 **City is free text and bilingual** — "cairo" (1,774), "القاهرة" (557), "القاهره" (189), "new cairo" (268), "مدينة نصر" (107), even "." (99). **A city/area normalization map is mandatory** because courier zones, UltraFast eligibility, and shipping all key on area. Plan: normalization table (top ~100 values cover most rows) + manual review of the tail; Veeey switches address entry to structured governorate→area dropdowns to stop new pollution.
- Passwords don't migrate (decided: email reset + social login).

---

## 5. Orders — export covers Jan 2025 → Jun 2026

- **5,707 orders** (2025: 3,818 · 2026 YTD: 1,889). Statuses in file are almost all delivered (Card Delivered 4,628 · Cash Delivered 1,041 · Shipped 37 · Processing 1) → **this export was filtered (delivered-only)**; the full-history export at cutover must include all statuses & years (user decision: migrate full history).
- **Order Total sum: 54.8M EGP → AOV 9,603 EGP.** Discounts: 581k EGP.
- Payment methods: cod 3,587 (63%) · bacs/bank 508 · **cheque 484 (label probably repurposed — verify what it maps to: wallet? POS?)** · kashier_card 480 · other 474 · bank_card 158.
- Custom columns confirmed live: **Origin, Pharmacist, Source (×2 — duplicate column), UTM** → matches the Veeey order-metadata design (Pharmacist, Order Source, attribution).
- 🚩 **Pharmacist values are free text and inconsistent** — "Dr Eltaib" (2,097) vs "Eltaib" (449), "Dr Karim" (1,906) vs "Karim" (315), "Abdelrahman Y."/"Dr Abdelrahman Y.", "A. Samir", "Rawan". Migration maps these to **user accounts** (≈5–6 real people) via a small alias table; Veeey stores pharmacist as a User reference, ending the drift.
- **Full live status vocabulary recovered** (from the `wc_order_status` export): *Pending Confirmation, Processing, Hold, Shipped, Cash Delivered, Card Delivered, Cancelled, Refunded, Failed, Draft, Edit.* This is richer than the 6 statuses specified earlier → the Veeey order lifecycle should be designed against this full set (notably **Pending Confirmation**, **Refunded**, **Failed**, and the **Draft/Edit** working states).

---

## 6. Reviews — 1,028

- Scores: 757× 5★, 75× 4.5, 71× 4, 65× 4.7, 13× 3, 11× 1, 23 missing. Fractional scores (4.4/4.5/4.7) = imported/aggregated entries.
- 842 have text content; **none have media**; cover 298 distinct products (legacy SKUs included → joinable).
- 🚩 Date anomalies: range shows 2013 → **2031** (future) — a handful of bogus timestamps to clamp at import.
- Clean import path: map by product SKU/ID, keep name + content + score + date; skip the 23 score-less or import as unrated.

---

## 7. SEO & redirects

- Redirect export: **exactly 1,000 rewrite rules (981 permanent)** — suspiciously round; the Rank Math dashboard reported ~2,000 redirects with 93.9k hits. **Re-export without the 1,000-row cap** (Rank Math CSV export or DB table `wp_rank_math_redirections`).
- Only 55 rules target `product/...` paths; most handle legacy/categorical URLs.
- Migration plan stands: preserve slugs 1:1 where possible; generate a redirect map for every changed URL; import the full Rank Math set; keep Rank Math meta (focus keywords + descriptions) on the new product/category records.

---

## 8. CMS content

- `...(1).xml`: **60 pages** (policies, about, etc.) + 126 attachments → migrate into Veeey CMS pages.
- `...(5).xml`: the 11 custom order statuses (§5) — small but valuable.
- `...(2)(3)(4).xml`: identical 691KB files with **0 items** (empty/duplicate runs) — discard.
- **Main 282MB XML: ~18,176 items, ≈17,980 of them are email-notification log posts** ("[Egypt Vitamins] Product out of stock", "New User Registration") — an email-log plugin's archive, **not site content. Discard.**
- 🚩 **The 81 blog posts are NOT in any provided export** → re-export (Tools → Export → Posts) for the Medical Blog migration.

---

## 9. Consolidated cleanup backlog (pre/при-migration)

| # | Task | Size | When |
|---|---|---|---|
| 1 | Brand normalization map (718 → ~200 canonical) | ~1 day with tooling | pre-migration |
| 2 | Attribute schema mapping + value dedupe (typos, twins) | 1–2 days | pre-migration |
| 3 | Tag curation (1,870 → governed list) | pharmacist review | pre-migration |
| 4 | City/area normalization map + structured address scheme | ~1 day + review | pre-migration |
| 5 | Pharmacist alias → user account mapping (~6 people) | trivial | migration script |
| 6 | Expired-lot write-off/quarantine (~840 lot records) | ops review | before stock migration |
| 7 | SKU regeneration (all products) + legacy-ID preservation | scripted | migration |
| 8 | Fill 689 missing weights · 22 missing SKUs · 81 drafts triage | ops/pharmacist | rolling |
| 9 | Review date clamps + score fixes | scripted | migration |
| 10 | GTIN backfill (only 163/2,739) | rolling program | post-launch |
| 11 | Arabic translation of ~2,200 untranslated products | **largest item** — decide MT+review vs phased | pre/post-launch decision |

## 10. Re-export checklist at cutover (fresh data day)

1. Products CSV (same 246-col format) ✅ works
2. **Orders: ALL years & ALL statuses** (current file was 2025+ delivered-only)
3. Customers CSV ✅ works
4. Reviews CSV ✅ works
5. **Rank Math redirects: full set** (current capped at 1,000)
6. **WordPress Posts export** (blog — missing entirely)
7. Pages export ✅ (have it; refresh)
8. ATUM: fresh lot snapshot (or skip — opening stocktake in Veeey can establish truth)
9. Media: product images pulled from URLs in the product CSV (~13.8k files)

## 11. Source → Veeey model mapping (summary)

| Source | Veeey target | Notes |
|---|---|---|
| Product CSV row | `Product` (+ SEO fields, images, attributes) | new SKU; `wpId`+`legacySku` kept |
| ATUM inventory row | `Lot` (product, expiryDate, qty, location=Main) | only live stock; expired → archive |
| Customer row | `Customer` (+ merged duplicates) | tier=Veeey Green (entry) default; loyalty seed from orders |
| Order row | `Order` (+ items, payment, status-mapped) | pharmacist→User; source/UTM→attribution |
| Review row | `Review` (by SKU/wpId) | clamp dates |
| Redirect rule | `Redirect` table (301s at edge/Next) | full set after re-export |
| Page/Post | CMS `Page` / `BlogPost` (AR/EN) | posts pending re-export |
| wc_order_status list | Status vocabulary seed | 11 statuses incl. Pending Confirmation/Refunded/Failed |
