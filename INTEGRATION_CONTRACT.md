# YeldnIN ↔ Veeey Integration Contract (v1)

> ⚠️ Snapshot — RE-BASELINE against the latest YeldnIN description before P14.

> **Source of truth** for the Veeey storefront build. Everything below is implemented in
> YeldnIN behind the `INTEGRATION_ENABLED` flag (default **off** — all integration routes
> return 404 and no events are emitted while off).
>
> Division of ownership: **Veeey** owns catalog (master), accounts, pricing/tiers, live
> sellable stock + FEFO selling, orders/payments/revenue, compensation math, courier
> selection. **YeldnIN** owns product requests, purchasing, supplier orders, trips/receiving
> (internal) **including the item-based expiry lots captured at intake** (sent to Veeey on
> `shipment.received`), supply-chain statuses, COGS, and own-courier / UltraFast delivery
> execution.

---

## 1. Authentication (both directions)

Every request — inbound (Veeey → YeldnIN `/api/integration/v1/**`) and outbound (YeldnIN →
Veeey webhook) — carries four headers:

| Header | Value |
|---|---|
| `X-Client-Id` | `veeey` (inbound) / `yeldnin` (outbound) |
| `X-Timestamp` | Unix **milliseconds**, as a string |
| `X-Nonce` | Unique per request (UUID recommended) |
| `X-Signature` | Lowercase-hex `HMAC-SHA256(canonical, sharedSecret)` |

```
canonical = METHOD \n path \n timestamp \n nonce \n sha256hex(rawBody)
```

- `METHOD` uppercased; `path` is the URL **pathname only** (no host, no query).
- `rawBody` is the exact bytes sent; for GET (empty body) hash the empty string.
- Timestamp must be within **±5 minutes** of the receiver's clock.
- A nonce may not repeat within the window → `401 nonce_replayed`.
- The shared secret is `INTEGRATION_CLIENT_VEEEY_SECRET` (≥ 32 chars), used by **both**
  directions. Verify with a constant-time comparison.
- Rate limit: 240 requests/min per client id → `429 rate_limited`.

Auth failures return `401 {"error":{"code":"missing_headers|unknown_client|timestamp_invalid|timestamp_out_of_window|nonce_replayed|bad_signature", ...}}`.

Reference implementations: `src/lib/integration/hmac-logic.ts` (sign + verify),
`scripts/integration-demo.mjs` (client), `scripts/mock-veeey-receiver.mjs` (receiver).

## 2. Idempotency (inbound mutations)

Every mutating endpoint **requires** an `Idempotency-Key` header (any unique string ≤ 200
chars; UUIDs recommended). Rules:

- First **successful (2xx)** response is persisted; replays with the same key return that
  exact response with header `Idempotency-Replayed: true` and execute nothing.
- Failed calls (4xx/5xx) are *not* persisted — retry with the same key is safe.
- Reusing a key on a *different* endpoint → `422 idempotency_key_reused`.
- Missing key on a mutating endpoint → `400 missing_idempotency_key`.

## 3. Error envelope

All JSON errors: `{"error": {"code": string, "message": string, "details"?: [...]}}`.
Validation failures are `422 validation_failed` with `details: [{path, message}]`.
Business-rule rejections are `422` with a specific code (listed per endpoint).
`500 internal_error` responses are safe to retry with the same Idempotency-Key.

---

## 4. Inbound endpoints (Veeey → YeldnIN)

Base: `https://in.yeldn.com/api/integration/v1`

### 4.1 `GET /health`
Auth check + liveness. → `200 {"ok":true,"version":"1.25","time":ISO,"clientId":"veeey","outbox":{"pending":n,"failed":n,"dead":n}}`

### 4.2 `POST /products/upsert` — catalog push (Veeey is catalog master)
```jsonc
{
  "sku": "VIT-D3-5000",            // required — canonical shared product key
  "name": "Vitamin D3 5000IU",     // required — must stay unique in YeldnIN
  "productType": "Supplements",     // optional — must match a YeldnIN ProductType name
  "estimatedWeight": 250,           // optional, grams
  "defaultSupplierName": "iHerb"    // optional — must match a YeldnIN supplier name
}
```
→ `200 {"productId":n,"sku":"...","created":bool}`.
Matching: by SKU first; else a same-name product **missing** a SKU adopts it; else created
(scope EGV). Errors: `unknown_product_type`, `unknown_supplier`, `name_conflict`,
`sku_conflict`, `product_scope_mismatch`.

### 4.3 `POST /requests` — create a restock / out-of-stock / special-order request
```jsonc
{
  "sku": "VIT-D3-5000",             // sku and/or productName (sku preferred)
  "productName": "Vitamin D3 5000IU",
  "quantity": 10,                    // int ≥ 1, default 1
  "priority": "RESTOCKING",          // RESTOCKING | OUT_OF_STOCK | SPECIAL_ORDER
  "productType": "Supplements",      // optional
  // SPECIAL_ORDER only ↓ (customer + sellingPrice are then REQUIRED)
  "customer": { "name": "Ali Hassan", "phone": "+20100…", "veeeyCustomerId": "VC-123" },
  "sellingPrice": 3500,              // EGP
  "deposit": 800,                    // EGP, optional (≤ sellingPrice)
  "purchasePrice": 40,               // optional expected cost (order currency)
  "veeeyOrderId": "VO-1001",         // optional — recorded on the request notes
  "notes": "..."
}
```
→ `201 {"uid":"O2606123","requestId":n,"scope":"EGV","priority":"…","slaDays":n|null,"slaDeadline":ISO|null,"estimatedDeliveryDate":ISO|null}`

- SLA (deadline) is computed by YeldnIN from its admin-managed `SlaRule`s (product-type rule
  beats supplier-type; seeded: FAST 20d, MANUFACTURER/STORES 30d, Injection 40d).
- Unknown SKU + no `productName` → `422 unknown_sku` (push the product first).
- Customers are deduped by `veeeyCustomerId`, then by exact name (scope EGV).
- Price guards may reject (`422 request_rejected` with the human message).

### 4.4 `GET /requests/{uid}` — status snapshot (sales-safe)
→ `200`:
```jsonc
{
  "uid":"O2606123", "sku":"VIT-D3-5000", "productName":"…", "quantity":10,
  "priority":"SPECIAL_ORDER",
  "salesStatusCode":"ORDERED", "internalStatusCode":"ORDERED",
  "slaDays":20, "slaDeadline":ISO|null, "estimatedDeliveryDate":ISO|null,
  "deliveredToCustomerAt":ISO|null, "cancelledAt":ISO|null, "createdAt":ISO,
  "orders":[{"batchId":n,"statusCode":"ORDERED","quantity":10,"trackingNumber":"1Z…"|null,"courier":"UPS"|null}]
}
```
**Never contains trips, travelers, suppliers or purchase prices.** Unknown / non-EGV uid → `404`.

### 4.5 `POST /revenue-events` — push revenue for reconciliation
```jsonc
{
  "requestUid": "O2606123",   // optional — special orders: always set
  "batchId": 456,             // optional — the YeldnIN order the sold lot came from
  "veeeyOrderId": "VO-1001",  // required
  "sku": "VIT-D3-5000",       // required
  "units": 1,                 // int ≥ 1, default 1 (restock sells unit-by-unit)
  "amountEgp": 3500,          // required, > 0
  "occurredAt": "2026-06-10T10:00:00Z" // required, ISO with offset
}
```
→ `201 {"id":n,"month":"2026-06"}`. Errors: `unknown_request`, `unknown_batch`, scope mismatches.
Many events per batch/request are expected. YeldnIN books these against per-order COGS
(purchase + handling + traveler fees) already stored. The existing manual `sellingPrice`
flow keeps working; where both exist for a request, **RevenueEvents take precedence** in
EGV/Veeey revenue reporting (Settings → Veeey Integration).

### 4.6 `POST /deliveries` — create an own-courier / UltraFast delivery job
```jsonc
{
  "veeeyOrderId": "VO-1001",
  "recipient": { "name": "Ali", "phone": "+20100…", "address": "12 X St", "area": "Nasr City" },
  "itemsSummary": "1× Vitamin D3 5000IU",
  "codAmount": 2700,                // EGP to collect (COD/POS)
  "paymentType": "COD",             // COD | POS | PREPAID (default COD)
  "ultraFast": true,                // 3–6h SLA, surfaced first to couriers
  "window": { "start": ISO, "end": ISO },  // optional delivery window
  "notes": "…"
}
```
→ `201 {"uid":"DJ2606001","id":n,"status":"NEW"}`.
This endpoint is the **only** way delivery jobs are created — there is no manual creation
inside YeldnIN. (Aramex/SMSA are Veeey's responsibility — do not send those here.)

### 4.7 `GET /deliveries/{uid}` — delivery job snapshot
→ `200 {uid, veeeyOrderId, status, ultraFast, paymentType, codAmount, courierName, courierPhone, assignedAt, outForDeliveryAt, postponedAt, deliveredAt, failedAt, returnedAt, collectedAmount, collectedMethod, reason, createdAt}`.
`courierName`/`courierPhone` are the **tracking details** once assigned (see §5.4).

### 4.8 `GET /attachments/{id}` — shipment photo fetch
Binary response (WebP/JPEG/PDF) under the same HMAC auth. Only photos referenced by
`shipment.received` events are accessible (everything else 404s).

---

## 5. Outbound events (YeldnIN → Veeey webhook)

`POST {VEEEY_WEBHOOK_URL}` — JSON, HMAC-signed (§1, `X-Client-Id: yeldnin`), plus
`Idempotency-Key` (dedupe on your side). Envelope:

```jsonc
{ "id": 123, "type": "…", "occurredAt": ISO, "payload": { … } }
```

Respond `2xx` to acknowledge. Anything else (or a timeout > 15s) is retried with backoff
**1m → 5m → 30m → 2h → 12h**, then the event is parked **DEAD** (admins can re-queue from
Settings → Veeey Integration). Events of the same aggregate (same request uid / delivery uid)
are delivered **in order** — a failing event holds back later ones for that aggregate.
All events are **EGV-scope only** and **never contain trip or traveler identity**.

### 5.1 `request.status_changed` — purchase progress
```jsonc
{ "requestUid":"O2606123", "salesStatusCode":"SHIPPED", "internalStatusCode":"SHIPPED_SUPPLIER",
  "trackingNumber":"1Z…"|null, "courier":"UPS"|null,
  "estimatedDeliveryDate":ISO|null, "deliveredToCustomerAt":ISO|null, "changedAt":ISO }
```
Emitted on every sales-status change (rollup of the request's orders).

### 5.2 `special_order.milestone` — compensation inputs
```jsonc
{ "requestUid":"O2606123", "milestone":"ordered|shipped|received_abroad|in_egypt|delivered",
  "salesStatusCode":"…", "slaDeadline":ISO|null, "occurredAt":ISO }
```
Emitted when a SPECIAL_ORDER request crosses a milestone. **Veeey computes late-delivery
compensation** from `slaDeadline` + these timestamps; YeldnIN does no discount math.

### 5.3 `shipment.received` — the stock-in handoff
Emitted when an incoming EGV shipment is marked **In Website** (the moment goods are
photographed, reviewed and ready to sell). Each item carries its **item-based expiry lots**
(captured in YeldnIN by Operations/Sales on the Incoming Shipment): each lot = some units
sharing one expiry month/year (+ optional manufacturer batch number). Build your sellable
FEFO stock from these.
```jsonc
{
  "shipmentId": 12, "receivedAt": ISO,
  "items": [ { "batchId":456, "requestUid":"O2606123", "sku":"VIT-D3-5000"|null,
               "productName":"…", "isGift":false, "quantity":10,
               "lots": [ { "quantity":6, "expiryMonth":6, "expiryYear":2026, "batchNumber":"AB-12"|null },
                         { "quantity":4, "expiryMonth":9, "expiryYear":2026, "batchNumber":null } ] } ],
  "photoUrls": [ "https://in.yeldn.com/api/integration/v1/attachments/789", … ]
}
```
`sku` is null only for legacy products that still lack one (see Settings → Product SKUs).
**`lots` may be empty or sum to fewer than `quantity`** — expiry capture is optional in
YeldnIN, so treat any shortfall as "expiry unknown" for those units. `expiryMonth` is 1–12.
Fetch photos with §4.8 auth. Use `batchId` later in `revenue-events`.

### 5.4 `delivery.status_changed` — courier execution
```jsonc
{ "deliveryJobUid":"DJ2606001", "veeeyOrderId":"VO-1001"|null,
  "status":"NEW|ASSIGNED|OUT_FOR_DELIVERY|POSTPONED|DELIVERED|FAILED|RETURNED",
  "courierName":"Ahmed M."|null, "courierPhone":"+20100…"|null, // tracking details (set once assigned)
  "collectedAmount":2700, "collectedMethod":"CASH|POS|NONE",    // DELIVERED only
  "reason":"…",                                                 // FAILED / POSTPONED / RETURNED
  "changedAt": ISO }
```
Emitted on creation and on every transition. **`status: "ASSIGNED"` is the "your order is
shipped" signal** — `courierName` + `courierPhone` are the tracking details; show the customer
*"Your order is shipped with `<courierName>`, phone `<courierPhone>`."* (Operations employees
deliver shipments too — the same fields carry their name/phone.)

---

## 6. Canonical status codes (stable contract values)

Payloads always carry **codes**, never display labels. These rows are seeded `isSystem`
(admins can relabel/recolor but the codes are stable; the seed re-asserts them).

- **salesStatusCode**: `NEW, ORDERED, SHIPPED, DELIVERED, OFFICE_ABROAD, GLOBAL_SHIPPING, CUSTOMS, IN_EGYPT, PHOTOS_SENT, ON_WEBSITE, COMPLETE, PARTIAL, CANCELLED`
- **internalStatusCode** (order/batch): `NEW, ORDERED, SHIPPED_SUPPLIER, DELIVERED_SUPPLIER, RECEIVED_ABROAD, GLOBAL_SHIPPING, CUSTOMS, IN_EGYPT, PHOTOS_SENT, ON_WEBSITE, DELIVERED_CUSTOMER, CANCELLED, LOST, DAMAGED`
- **delivery status**: `NEW, ASSIGNED, OUT_FOR_DELIVERY, POSTPONED, DELIVERED, FAILED, RETURNED`
  (`POSTPONED`/`FAILED` may go back `OUT_FOR_DELIVERY`; `FAILED/POSTPONED/RETURNED` carry a `reason`)
- **milestones**: `ordered, shipped, received_abroad, in_egypt, delivered`
- **priorities**: `RESTOCKING, OUT_OF_STOCK, SPECIAL_ORDER`

## 7. Environment variables (YeldnIN side)

| Var | Meaning |
|---|---|
| `INTEGRATION_ENABLED` | `true` to activate (default off → routes 404, no events) |
| `INTEGRATION_CLIENT_VEEEY_SECRET` | Shared HMAC secret, ≥ 32 chars (`openssl rand -hex 32`) |
| `VEEEY_WEBHOOK_URL` | Veeey's receiver, e.g. `https://veeey.example/webhooks/yeldnin` |
| `APP_URL` | Public base URL (absolute `photoUrls`) — already required |

## 8. Operational notes

- YeldnIN is SQLite + a single PM2 writer: keep inbound traffic **transactional, not chatty**
  (one call per business event; no polling loops — consume the webhooks).
- The outbox dispatcher runs in-process every 30s (started from `src/instrumentation.ts`).
- Admin visibility & manual retry: **Settings → Veeey Integration**. SKU backfill utility:
  **Settings → Product SKUs**. New EGV products created in YeldnIN require a SKU.
- Local end-to-end demo: `node scripts/mock-veeey-receiver.mjs` + `node scripts/integration-demo.mjs`
  (see headers of both files).
