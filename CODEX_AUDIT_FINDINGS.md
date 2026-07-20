# Veeey Deep Audit Findings

Audit date: 2026-07-20

## Section 1 — Defects

### [P0] Tier product rules are advertised but never enforced in commerce

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/tier-service.ts:61`, `src/lib/pricing-service.ts:6`, `src/lib/cart-service.ts:113`, `src/lib/checkout-service.ts:103`, `VEEEY_PRD.md:107`
- What's wrong: Admins can define tier-specific price, visibility, and availability rules, but only a Select-tier teaser on the PDP calls `effectiveTierPrice`. Cart and checkout price reservations from the lot/base price and never evaluate any tier rule; visibility and availability rules have no storefront enforcement path at all.
- Failure scenario: An admin makes a product unavailable to Green members and discounted for Select members. Green customers can still see and buy it, while Select customers are charged the undiscounted base/lot price.
- Suggested fix: Resolve the signed-in customer's tier in the catalog/PDP, reservation, cart, and checkout services; enforce visibility/availability server-side and snapshot the effective tier price on each reservation/order item. Add a final checkout revalidation inside the order transaction.
- Blast radius: Every signed-in customer and every configured tier product rule; direct overcharge, undercharge, and access-policy failures.

### [P0] Advanced coupon restrictions and FREE_ITEM coupons are inert

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/coupon.ts:27`, `src/lib/coupon-service.ts:22`, `src/lib/coupon-service.ts:48`, `prisma/schema.prisma:640`, `VEEEY_PRD.md:112`
- What's wrong: `FREE_ITEM` always calculates a zero discount and no service code adds an item. The schema's `categoryId` and `tierId` restrictions are neither exposed by the save schema nor checked by `applyCoupon`, despite FR-PRC-07 requiring all three behaviors.
- Failure scenario: Staff issues a free-item or tier/category-limited campaign. The code accepts the coupon but supplies no gift, or applies a restricted discount to an ineligible basket/customer.
- Suggested fix: Model the free product and eligible product/category/tier explicitly, expose them in admin validation, and evaluate them against concrete cart lines inside the checkout transaction. Reject unsupported legacy rows rather than treating them as successful coupons.
- Blast radius: Any advanced coupon campaign; incorrect discounts, missing promotional goods, and customer-support/refund costs.

### [P0] Coupon usage limits are check-then-act and can be exceeded concurrently

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/coupon-service.ts:28`, `src/lib/checkout-service.ts:134`, `src/lib/checkout-service.ts:255`, `prisma/schema.prisma:654`
- What's wrong: Usage counts are read before the checkout transaction, while the redemption is inserted later. `CouponRedemption` has no uniqueness or serialized counter constraint, so two checkouts can both observe capacity and redeem the last allowed use.
- Failure scenario: Two customers submit a single-use code at the same time. Both count zero redemptions, both receive the discount, and both redemption rows commit.
- Suggested fix: Claim coupon capacity in the same serializable transaction as order creation, using an atomic bounded counter or an appropriate unique claim for single-use/per-customer rules. Retry serialization conflicts.
- Blast radius: Limited-use promotions and every order placed near a coupon's usage boundary.

### [P0] Concurrent checkouts can redeem the same loyalty balance twice

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/checkout-service.ts:139`, `src/lib/checkout-service.ts:258`, `prisma/schema.prisma:404`, `prisma/schema.prisma:605`
- What's wrong: Checkout reads and caps the points balance before entering the order transaction, then unconditionally decrements it inside the transaction. There is no `pointsBalance >= requested` update predicate, non-negative database constraint, or redemption claim.
- Failure scenario: A customer with 1,000 points submits two checkouts redeeming 1,000 points. Both prechecks see 1,000, both discounts commit, and the balance becomes -1,000.
- Suggested fix: Atomically decrement with `WHERE pointsBalance >= usePoints` inside checkout and abort if no row is updated. Add a non-negative database constraint and an order/type uniqueness guard for loyalty mutations.
- Blast radius: Loyalty customers using multiple tabs, retries, or double-submits; direct discount loss and corrupt balances.

### [P0] Checkout consumes stale reservations without revalidating lot safety

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/checkout-service.ts:83`, `src/lib/checkout-service.ts:183`, `src/lib/checkout-service.ts:217`, `src/lib/inventory-service.ts:158`, `src/lib/inventory-service.ts:257`
- What's wrong: Reservations are loaded before the transaction and checkout never checks `expiresAt`, lot status, current expiry, or available quantity before blindly decrementing `qtyOnHand` and `qtyReserved`. Reservation creation has those guards, but they can become false before checkout.
- Failure scenario: A held lot is quarantined, written off, or passes its expiry before the customer checks out. The order still binds and sells that exact lot; an administrative stock reduction can also let the blind decrement make inventory negative.
- Suggested fix: Re-read and claim every reservation inside the transaction with predicates for reservation ownership/non-expiry and lot `LIVE`, non-overdue, and sufficient counters. Fail checkout with a cart-reallocation message if any claim fails.
- Blast radius: Customers with aging carts and any lot changed by operations while reserved; product-safety and inventory-integrity risk.

### [P0] Manual lot edits can recreate sold stock and violate active reservations

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/inventory-service.ts:104`, `src/lib/inventory-service.ts:119`, `src/lib/inventory-service.ts:231`
- What's wrong: `saveLot` reads a quantity and later writes an absolute `qtyOnHand` value without a compare-and-swap predicate or lock. It also permits `qtyOnHand < qtyReserved`; the transaction does not prevent a concurrent checkout from committing between the read and absolute write.
- Failure scenario: Staff opens a lot at 10 units, a checkout sells one, then staff saves the unchanged form value 10. The sold unit is recreated; lowering a lot below its reserved count produces negative sellable stock and can drive on-hand negative at checkout.
- Suggested fix: Treat quantity edits as signed deltas with an atomic availability guard, or lock/CAS the row using its prior `updatedAt`/quantity. Reject any result below `qtyReserved` and make non-quantity metadata edits leave counters untouched.
- Blast radius: Every manually edited lot, especially during active sales.

### [P0] Stocktake approval overwrites sales that occur during reconciliation

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/stocktake-service.ts:259`
- What's wrong: Reconcile rows and current quantities are read before the apply loop. Each lot is then set to the absolute counted quantity in a separate transaction, with no row lock or comparison to the previously read quantity, and the session closes separately after all rows.
- Failure scenario: Reconcile reads a lot at 10 with a count of 9; a checkout sells one, making it 9; approval then writes 9 and records a -1 variance, effectively losing the sale's stock delta in the ledger-to-balance relationship. A mid-loop failure also leaves a partially applied open session.
- Suggested fix: Apply the entire session atomically where practical, or CAS each lot against the reconciled current quantity and refuse approval on conflicts. Close the session only after every adjustment succeeds and make each applied row uniquely idempotent.
- Blast radius: All stocktakes performed while the store is accepting orders.

### [P0] Order status is committed before its stock, payment, revenue, and loyalty effects

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/order-service.ts:173`, `src/lib/order-service.ts:213`, `src/lib/order-service.ts:239`
- What's wrong: `transitionOrder` compare-and-swaps the status first, then runs several independent effects outside that transaction. If any effect fails, the status cannot be retried because the source transition is no longer valid. `restockOrder` also uses the existence of any first ledger marker as the whole-order marker, while updating lines one by one.
- Failure scenario: Cancelling a multi-line order restocks the first line and writes its marker, then the second update fails. The order is already cancelled; retry is rejected, and `restockOrder` now sees the first marker and skips the remaining line forever.
- Suggested fix: Persist a transition/effect record and execute all local database effects in one transaction, with unique per-effect/per-line keys. Move external outbox creation into that transaction and let a retryable worker finish pending effects.
- Blast radius: Any order transition encountering a transient database/integration error; stranded payments, stock, points, or revenue.

### [P0] Return records can suppress cancellation restock and can be processed repeatedly

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/server/account-actions.ts:11`, `src/lib/return-service.ts:12`, `src/lib/return-service.ts:55`, `src/lib/order-service.ts:184`, `prisma/schema.prisma:1446`
- What's wrong: Customers can create repeated full-quantity returns with no status/window/remaining-quantity check. `restockOrder` subtracts every requested `ReturnItem`, even if the return has never been processed, and `processReturn` has no state/idempotency guard before creating a new quarantine lot.
- Failure scenario: A customer requests a return and the order is then cancelled before return intake. Cancellation excludes those merely requested units and leaks stock. Separately, re-submitting RESTOCK for one return creates another quarantine lot for the same physical units.
- Suggested fix: In one transaction, validate order eligibility and aggregate remaining returnable quantity; uniquely claim each order item quantity. Count only completed inventory dispositions when suppressing cancellation restock, and make processing a guarded one-way state transition with per-item movement keys.
- Blast radius: Returned or cancelled orders; duplicate or missing inventory and potentially duplicate refunds.

### [P0] Unrelated staff roles can read the global admin dashboard and other hidden modules

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/app/[locale]/admin/layout.tsx:24`, `src/lib/rbac.ts:29`, `src/app/[locale]/admin/page.tsx:56`, `src/app/[locale]/admin/inventory/page.tsx:10`, `src/app/[locale]/admin/quizzes/page.tsx:8`, `src/lib/permissions.ts:125`
- What's wrong: The admin layout admits anyone with any permission, while the dashboard directly queries revenue, customer counts, orders with customer names, and inventory without a page-level read permission. Inventory and quiz overview pages likewise rely on hidden navigation rather than enforcing their advertised permissions on reads.
- Failure scenario: A Courier user, whose only grant is `couriers.access`, deep-links to `/admin` and sees revenue, recent customers/orders, and stock data; they can also deep-link to inventory/quiz overviews.
- Suggested fix: Give the dashboard an explicit permission or render only independently permission-gated widgets. Add `requirePermission`/`requireAnyPermission` to every admin read page, including overview pages; navigation filtering remains presentation only.
- Blast radius: Financial, operational, and customer data visible to all low-privilege staff accounts.

### [P0] Inbound webhook idempotency is not an atomic claim

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/app/api/integration/yeldnin/webhook/route.ts:26`, `src/app/api/integration/yeldnin/webhook/route.ts:40`, `src/lib/integration/integration-service.ts:96`, `src/lib/integration/integration-handlers.ts:29`
- What's wrong: The route checks for an idempotency record, performs the mutation, then inserts the record while swallowing duplicate-insert errors. Two requests with the same idempotency key and different valid nonces can both mutate; handlers such as shipment receiving also perform multiple writes without a surrounding transaction.
- Failure scenario: YeldnIN retries `shipment.received` concurrently. Both requests see no record and both create every lot; the second idempotency save loses the race silently, leaving doubled stock. A mid-handler crash can similarly commit only some lots and replay them on retry.
- Suggested fix: Atomically claim the key before dispatch with a processing state and request hash, execute local mutations transactionally, then store the response. Replays should wait for or return the completed claim; abandoned claims need a safe retry protocol.
- Blast radius: All enabled inbound integration mutations; highest impact is duplicate/partial inventory receiving.

### [P0] Shipment receiving discards units whose expiry is unknown

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/integration/integration-handlers.ts:35`, `INTEGRATION_CONTRACT.md:222`
- What's wrong: The contract says `lots` may be empty or sum below `item.quantity` and the shortfall must become expiry-unknown stock. The handler explicitly creates only supplied lots and drops the difference.
- Failure scenario: A shipment item reports quantity 10 with one six-unit expiry lot. Veeey creates six units and silently loses the other four.
- Suggested fix: Validate non-negative quantities and create one quarantine lot with `expiryDate: null` for `item.quantity - sum(lots)`; reject over-specified totals rather than silently accepting them.
- Blast radius: Every integrated shipment with incomplete expiry capture; systematic inventory understatement.

### [P0] veeey.net stock writeback can apply the same WordPress delta twice after a crash

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/net-sync/writeback.ts:74`, `prisma/schema.prisma:2134`
- What's wrong: The worker mutates WordPress first and marks the local row `APPLIED` afterward. The unique database key makes enqueue idempotent, not remote application idempotent; there is an unavoidable crash window between the two systems.
- Failure scenario: WordPress successfully decreases stock, then the process exits before line 90. The row remains `PENDING`, and the next drain decreases WordPress a second time.
- Suggested fix: Send a stable operation id to an idempotent remote endpoint/ledger and reconcile its result before retrying. If WordPress cannot support that, use absolute expected stock with version checks plus a reconciliation queue rather than retrying blind deltas.
- Blast radius: veeey.net orders during worker/process/network failures; cross-store stock drift and false out-of-stock states.

### [P1] Checkout accepts shipping and payment choices that the server never authorizes

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/components/storefront/checkout-form.tsx:13`, `src/components/storefront/checkout-form.tsx:62`, `src/app/[locale]/(shop)/checkout/page.tsx:37`, `src/lib/checkout-service.ts:30`, `src/lib/shipping-service.ts:100`, `src/lib/payment-method-service.ts:24`
- What's wrong: Area eligibility for UltraFast/POS is reduced to “any eligible area in this governorate” in the client, and checkout does not even render/submit an area field. The server accepts any non-empty payment code, checks neither payment membership nor shipping enablement/area eligibility, and simply looks up the requested shipping fee.
- Failure scenario: A crafted checkout posts `paymentMethod=FREE` and UltraFast for an ineligible area, or an ordinary shopper selects a governorate where only one sub-area qualifies. The order is created as pending with an unknown payment method and an operationally impossible SLA.
- Suggested fix: Submit a canonical `shippingAreaId`, derive governorate/city from it, and validate the enabled shipping/payment choices server-side against that exact area and configured gateways. Reject unknown codes before creating an order.
- Blast radius: Checkout, fulfillment, POS collection, and UltraFast promises for all areas with mixed eligibility.

### [P1] Checkout silently ignores invalid coupons and shows a total it will not charge

- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: `src/lib/checkout-service.ts:131`, `src/components/storefront/checkout-form.tsx:159`, `src/components/storefront/checkout-form.tsx:185`, `src/server/cart-actions.ts:155`
- What's wrong: A failed coupon check is ignored and order placement continues at full price. Before submission, the summary includes only subtotal plus the selected shipping fee; it does not reflect coupon, points, or tier shipping waivers, and checkout maps most failures to one generic error.
- Failure scenario: A customer enters an expired code and 2,000 points while their tier waives shipping. The page still shows the undiscounted total, then places a full-price order when the coupon is invalid without explaining that the code was rejected.
- Suggested fix: Add a server-authoritative quote/apply step returning line-item discounts and reason-specific coupon errors. Require explicit correction/acknowledgement before placing an order when a supplied coupon is invalid.
- Blast radius: Every coupon/points/tier-benefit checkout; avoidable abandonment and full-price orders customers did not intend.

### [P1] Stocktake count sheets double-count reserved units

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/stocktake-service.ts:117`, `src/lib/stocktake-service.ts:151`, `src/lib/inventory-service.ts:231`
- What's wrong: Reservation creation increments `qtyReserved` but does not reduce `qtyOnHand`, so physical on-hand already includes reserved units. The stocktake sheet reports `qtyOnHand + reservations`, inflating expected stock by every active reservation.
- Failure scenario: A lot has 10 units on the shelf, two reserved. The sheet says 12; a correct physical count of 10 appears as a -2 variance and can prompt staff to enter/apply an inflated quantity.
- Suggested fix: Use `qtyOnHand` as the physical expectation and show reserved/sellable quantities as separate informational columns. Snapshot the expected counters when the count is recorded.
- Blast radius: Every stocktake containing actively reserved lots.

### [P1] Delivery integration acknowledges status events without applying them

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/integration/integration-handlers.ts:81`, `INTEGRATION_CONTRACT.md:258`
- What's wrong: The handler ignores `status`, courier phone, collection amount/method, failure reason, and timestamp; it only sets courier to `OWN` when a name is present and returns `matched: true`. No order transition, tracking detail, payment effect, or customer notification occurs.
- Failure scenario: YeldnIN sends ASSIGNED and then DELIVERED with a COD collection. Veeey acknowledges both, but the order remains pending/unshipped, the customer sees no courier contact, and revenue/loyalty/payment effects never run.
- Suggested fix: Validate and map each contract status to the configured order transition pipeline, persist courier/contact/collection metadata, and return an error for unsupported transitions so the sender can retry or alert.
- Blast radius: Own-courier/UltraFast orders when the integration is enabled; stale tracking, payment, and accounting state.

### [P1] Order CSV “to” dates exclude almost the entire selected day

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/lib/export-service.ts:15`, `src/lib/order-service.ts:104`
- What's wrong: The order list expands `to` to 23:59:59, but the CSV export uses `lte: new Date(opts.to)`, which is midnight at the start of that date. The sibling views therefore disagree for the same filter.
- Failure scenario: Staff filters July 20 and sees all July 20 orders, then exports the same range; the CSV contains only orders timestamped exactly at or before 00:00 on July 20.
- Suggested fix: Parse date-only filters in the store timezone and use an exclusive next-day boundary (`lt startOfNextDay`) in one shared helper used by list, aggregates, and export.
- Blast radius: Finance/operations exports for every date range with an end date.

### [P1] The cart hides mixed expiry and price allocations behind one badge

- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: `src/lib/cart-service.ts:113`, `src/app/[locale]/(shop)/cart/page.tsx:84`
- What's wrong: Reservations for the same product/condition are grouped into one line even when they span lots with different expiries and prices. The UI shows only the earliest expiry and a combined subtotal, so the exact lots selected on the PDP are no longer obvious even though checkout later creates separate order items.
- Failure scenario: Quantity two is allocated one unit from an August discounted lot and one from an October full-price lot. The cart displays quantity two with only “Exp Aug” and no per-lot prices, making the brand's expiry/price promise misleading.
- Suggested fix: Render allocation sub-lines by lot expiry and unit price, or keep cart lines lot-bound. Preserve grouped quantity controls only if the resulting reallocation is previewed before saving.
- Blast radius: Multi-unit purchases spanning lots; the storefront's core expiry/price differentiator.

### [P1] Database-backed route transitions have no loading fallback

- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: `src/app` (142 `page.tsx` files; zero `loading.tsx` files)
- What's wrong: No App Router segment supplies a loading UI, despite many storefront/admin pages awaiting multiple database queries. On slow navigation, users receive no progress state and can interpret the retained screen as a missed click.
- Failure scenario: An operator opens analytics or inventory over a slow connection and repeatedly clicks because the previous page remains unchanged until the full server render completes.
- Suggested fix: Add shared locale/admin/storefront `loading.tsx` boundaries first, then focused skeletons for the heaviest route groups and pending states on mutating forms.
- Blast radius: All route transitions, most noticeably admin analytics, inventory, search, and checkout.

### [P1] Core storefront controls do not meet the audit's keyboard and touch-target requirements

- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: `src/components/storefront/checkout-form.tsx:15`, `src/components/storefront/plp-filters.tsx:13`, `src/app/[locale]/(shop)/cart/page.tsx:108`, `src/app/globals.css:296`
- What's wrong: Multiple storefront fields remove the outline and replace it only with a low-contrast lime border/background change; the global high-contrast `:focus-visible` rule is scoped to admin. Cart Update/Remove are text-size buttons without padding or a minimum size, far below the required 44px target.
- Failure scenario: A keyboard user cannot reliably locate focus in checkout/filter forms, while a touch user on a 320px phone repeatedly misses Update/Remove and may change the wrong line.
- Suggested fix: Add a storefront-wide high-contrast `focus-visible` ring primitive and apply at least 44px hit areas to action controls without necessarily increasing their visual weight.
- Blast radius: Keyboard and mobile users across checkout, filters, PDP forms, addresses, special order, and cart.

### [P2] Wishlist alert settings lack an ownership check

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `src/server/engagement-actions.ts:41`, `src/lib/wishlist-service.ts:38`
- What's wrong: The server action neither authenticates a customer nor constrains the item update by that customer's wishlist; it updates solely by `WishlistItem.id`. The high-entropy CUID reduces guessability but does not provide authorization if an ID is exposed.
- Failure scenario: A caller obtains another wishlist item ID from logs, markup, or a future API and posts the server action, disabling or enabling that customer's alerts.
- Suggested fix: Require the current customer and update via an ownership predicate (`id` plus `list.customerId`), returning not-found for mismatches.
- Blast radius: Wishlist notification preferences for any item ID that leaks outside its owner context.

### [P2] Two admin RTL affordances remain physically LTR

- Confidence: CONFIRMED (traced)
- Type: ui-ux
- Location: `src/app/[locale]/admin/notifications/page.tsx:44`, `src/app/[locale]/admin/page.tsx:127`
- What's wrong: Notification error spacing uses `ml-2`, and the “orders need attention” ArrowRight does not rotate in RTL. These are isolated exceptions in an otherwise logical-utility sweep.
- Failure scenario: In Arabic, notification spacing appears on the wrong side and the dashboard CTA arrow points away from the destination flow.
- Suggested fix: Replace `ml-2` with `ms-2` and add `rtl:rotate-180` (or a locale-aware icon) to the arrow.
- Blast radius: Arabic admin users on the dashboard and notifications page.

### [P2] Several hot query predicates have no supporting index

- Confidence: CONFIRMED (traced)
- Type: engineering
- Location: `prisma/schema.prisma:1001`, `prisma/schema.prisma:1014`, `prisma/schema.prisma:605`, `prisma/schema.prisma:1078`
- What's wrong: `LotReservation` is repeatedly queried by `sessionId` and swept by `expiresAt` but is indexed only by `lotId`; `MovementLedger` status-effect lookup filters `refType/refId` but is indexed only by `lotId`; loyalty idempotency filters `orderId/type` but has only `customerId`; order date-range/sort queries lack a `placedAt` index.
- Failure scenario: As reservations, ledger rows, loyalty transactions, and orders grow, cart/checkout, cleanup, status transitions, and reports degrade into table scans and longer lock windows.
- Suggested fix: Add indexes based on measured plans: `LotReservation(sessionId)`, `LotReservation(expiresAt)`, `MovementLedger(refType, refId)`, `LoyaltyTransaction(orderId, type)`, and relevant `Order(placedAt)`/status-date composites.
- Blast radius: Site-wide latency and concurrency headroom as production data grows.

## Section 2 — UI/UX enhancements

### Make checkout a server-authoritative live quote

- Problem it solves: Customers cannot see which coupon, points, tier benefit, shipping fee, or deposit will actually be charged until after order creation.
- Proposed change: Add a debounced “apply/recalculate” quote action that returns subtotal, each discount/waiver, deposit, balance, and final due amount using the same pure calculation and validation path as order placement.
- Expected impact: Fewer abandoned or disputed orders and much clearer promotion/loyalty value for all checkout users.
- Effort: M
- Touches a LOCKED screen? no

### Carry one canonical delivery area from cart through checkout

- Problem it solves: The cart's exact area/ETA check is discarded at checkout, which falls back to free-text city and governorate-wide eligibility.
- Proposed change: Persist/pass `shippingAreaId`, preselect it from saved addresses or the cart, display its bilingual zone/ETA, and derive available shipping/payment methods from that exact record.
- Expected impact: Faster address entry, fewer impossible UltraFast/POS selections, and more reliable delivery promises.
- Effort: M
- Touches a LOCKED screen? no

### Keep expiry and price allocations visible after the PDP

- Problem it solves: Multi-lot cart lines obscure which expiry each unit has and why the combined price changed.
- Proposed change: Show compact per-lot sub-lines (quantity, month/year, unit price, condition) in cart, checkout review, confirmation, and account order detail, all from the same order/reservation snapshots.
- Expected impact: Reinforces Veeey's main differentiator and reduces expiry/price disputes.
- Effort: M
- Touches a LOCKED screen? no

### Add recovery-oriented progress for operations workflows

- Problem it solves: Stocktake apply, order transitions, returns, webhook intake, and writeback can involve multi-step effects, but operators lack a clear pending/failed/retry state.
- Proposed change: Introduce a small operations exceptions view showing effect state, completed steps, failure reason, safe retry/reconcile action, and audit link for each order/integration operation.
- Expected impact: Shorter recovery time and fewer manual database corrections when transient failures occur.
- Effort: L
- Touches a LOCKED screen? no

### Make the admin landing page role-aware

- Problem it solves: A global dashboard is both overexposing for narrow roles and noisy for daily task completion.
- Proposed change: Build dashboard sections from explicit widget permissions and give Courier, Inventory, Support, Finance, and Content roles focused queues/KPIs with a clear permission-denied empty state for unavailable modules.
- Expected impact: Faster daily work, less sensitive-data exposure, and clearer role boundaries.
- Effort: M
- Touches a LOCKED screen? no

### Add route skeletons and form pending feedback as shared primitives

- Problem it solves: Slow server navigation and mutations currently appear inert, encouraging duplicate clicks.
- Proposed change: Add shared storefront/admin skeleton layouts plus reusable pending buttons, `aria-live` result banners, and double-submit prevention for server-action forms.
- Expected impact: Better perceived speed and fewer accidental duplicate submissions across the site.
- Effort: M
- Touches a LOCKED screen? no

### Standardize accessible storefront controls

- Problem it solves: Focus visibility and touch hit areas vary across checkout, filters, cart, PDP, and account forms.
- Proposed change: Create tokenized field/action classes with a 3:1+ `focus-visible` indicator, 44px hit area, consistent disabled/pending state, and error/help text linkage via `aria-describedby`.
- Expected impact: Materially better keyboard, low-vision, and mobile usability with a small reusable change surface.
- Effort: S
- Touches a LOCKED screen? no

### Replace generic checkout failures with actionable bilingual recovery

- Problem it solves: “Generic error” does not tell customers whether to refresh stock, change delivery, fix a coupon, choose another payment method, or retry verification.
- Proposed change: Return stable error codes from quote/place-order paths and map each to bilingual inline guidance while preserving the entered form values and focusing the first invalid section.
- Expected impact: Higher checkout completion and lower support load.
- Effort: S
- Touches a LOCKED screen? no

## Section 3 — Coverage log

### Baseline and constraints

- Read `AGENTS.md`, `PROJECT_STATUS.md`, `CODEX_AUDIT_BRIEF.md`, the root PRD/SPEC, the Prisma schema, `INTEGRATION_CONTRACT.md`, and the relevant product/customer integration contract references. `Imports/`, `.env*`, production databases, remote servers, and authenticated/live transactions were not accessed.
- TypeScript strict typecheck completed successfully using the installed compiler directly. `npm run test` could not start because this workstation's npm shim is missing and direct Vitest startup is blocked by the absent optional native package `@rolldown/binding-win32-x64-msvc`; no dependencies were installed or changed in this read-only audit. Therefore the repository's reported ~595-test baseline was not independently re-established.
- The review was static. No local Postgres-backed app was available, and no live storefront forms were submitted.

### Engineering domains reviewed

- Checkout/cart/pricing: traced `cart-service`, reservation creation/release, `checkout-service`, cart server actions, checkout UI, coupon pure/service/admin paths, tier pricing/rules, tier benefits, payment method and shipping services, gift call sites, preorder pricing, and relevant tests. Confirmed tier enforcement, coupon, points, eligibility, stale-lot, quote, and multi-lot presentation defects; BigInt subtotal/discount/deposit primitives themselves were clean in the paths inspected.
- Inventory: traced lot create/edit/status, atomic reservation claims, reservation release/expiry, FEFO call sites, stocktake sheet/record/reconcile/apply, movement ledger markers, expiry guards, and schema indexes. Reservation creation's conditional stock claim and concurrent release rollback were clean; checkout revalidation, manual edits, and stocktake were not.
- Orders/returns: traced order list date parsing, status transition CAS, status-config effects, restock markers, loyalty/referral effects, manual-order atomic stock claims, customer return creation, return processing, and related models/actions. Manual order allocation uses a conditional stock claim; transition effect bounds and returns lifecycle do not provide the same safety.
- Auth/RBAC/privacy: reviewed the admin layout, runtime RBAC helpers, role definitions, navigation permissions, direct-Prisma admin overview pages, selected admin actions/services, wishlist actions, confirmation gating references, and security-sink scans. No unsafe raw-query or obvious unsanitized-eval sink was found in the scan; admin read authorization and wishlist alert ownership defects remain. This was not a line-by-line proof of every one of the 142 routes/actions.
- Loyalty/tiers/benefits: reviewed customer/tier schema, tier product rules, effective pricing, redemption, earn/reversal idempotency lookups, manual tier locks/status notes, and benefit gates. Tier benefits for pre-order/discreet/free shipping are consulted; product rules and atomic balance claims are not.
- YeldnIN integration: traced HMAC/nonce verification, idempotency lookup/save, webhook dispatch, shipment receiving, request upsert, delivery events, outbox references, schemas, and contract payload rules. Signature/nonce recording is present; mutation idempotency, atomic receiving, shortfall handling, and delivery mapping fail the contract. Integration remains intentionally feature-gated; findings describe behavior when enabled, not the dormancy itself.
- veeey.net sync: reviewed writeback enqueue schema/uniqueness, status-to-delta logic/tests, and drain/apply ordering. Enqueue dedupe is present, but remote application is not exactly-once across crashes. The broader importer/pull transform was sampled rather than exhaustively re-audited.
- Analytics/reporting: reviewed order list/export date predicates, selected analytics/report queries, export permission calls, visitor consent references, and schema date indexes. Confirmed the CSV end-date mismatch; no concrete consent leak or unsafe money aggregate was proven in inspected paths.
- Performance/schema: reviewed hot reservation, order, ledger, loyalty, integration idempotency/nonce, wishlist, return, and writeback models against their callers. Reported only predicates with clear repeated production call sites; no runtime query plans were available.
- Security hygiene: scanned for unsafe raw SQL, `eval`/`Function`, obvious secret/PII logging, dangerous redirects, and rich-HTML sinks, and checked representative sanitization/upload patterns referenced by callers. No additional concrete injection, open-redirect, or secret-in-code finding was proven. Provider-specific gateway/carrier implementations, media processing, AI/MCP actions, DSAR internals, and every worker handler were not exhaustively reviewed.

### UI/UX domains reviewed

- RTL/i18n: compared EN/AR message key inventories (589 keys each, no missing/orphan keys found), swept TSX for physical directional utilities and directional icons, and sampled locale-aware dates/currency. The two reported admin exceptions were the concrete misses; generated/provider codes and product names were not treated as translation defects.
- Storefront flow: statically walked browse/filter/search, PDP lot selection, cart, area/ETA check, guest/account checkout including OTP UI, confirmation references, account orders/returns, addresses, wishlist alerts, tier/benefit and refill surfaces. The locked homepage was not redesigned. No browser-based 320/375/768/1024/1440 visual verification was possible.
- Admin flow: statically walked dashboard/navigation, order processing, inventory overview/lots/intake, stocktake, returns, coupons/tiers, notifications, selected analytics/export, quizzes, and integration-facing operations. Tables sampled generally used local overflow containers and headings/empty rows; a complete panel-by-panel five-state inventory was not possible.
- Accessibility/responsive/state sweep: found zero route `loading.tsx` files, three route error boundaries, one not-found boundary, sampled table wrappers, searched focus styles, touch controls, ARIA/directional icons, and color-only cues. Admin has a shared focus-visible rule; storefront coverage is inconsistent. Findings are static class/semantic conclusions, not assistive-technology test results.

### Explicitly not fully covered

- A truly separate-session, twice-clean pass over every domain was not possible in one task invocation. The highest-risk call graphs were followed repeatedly and candidate findings were checked for caller-side guards/tests before inclusion.
- Not exhaustively reviewed: every admin route/server action, all 142 page state combinations, every cron/job handler, full WooCommerce import/pull logic, payment gateway/carrier protocol internals, all AI/MCP approval actions, media/SEO/CMS rendering, DSAR execution, and pixel-level responsive/dark-theme behavior. These should receive follow-up focused passes before treating this report as total-system assurance.
