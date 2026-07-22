# Checkout backlog — owner feedback 2026-07-22 (after the first successful Kashier payment)

✅ **Kashier v3 works end to end.** A real order paid successfully — validating the Payment
Sessions v3 migration, the secret-key auth fix, and `serverWebhook`.

Items below are in the order I'd do them: correctness first, then UX.

---

## 🔴 P0 — a card failure silently creates an unpaid order
Found from the owner's two failed test orders (`VY-MRVZGPAS-284`, `VY-MRVZHS69-698`): when the
gateway call fails, `buildCardRedirect` returns null and checkout **creates the order anyway** as
PENDING/PENDING and shows a confirmation page. No payment, no error, no redirect.

The fallback is deliberate ("don't send a customer to a broken page") but it is wrong for CARD: a
customer who chose Visa/MasterCard and was never asked for a card must be told the payment could not
start. As it stands a gateway outage quietly converts card orders into unpaid orders, discoverable
only by reconciling takings against orders.

**Fix:** a failed card session BLOCKS the order with "payment could not be started, please try
again". Keep the pending fallback only for genuinely offline methods (COD, bank transfer).
Delete/cancel the two artefact orders above.

## 🔴 P0 — order-placed SMS fires before payment (owner item 2)
The customer got the placement SMS at redirect time, not on payment success. Same root cause as
above: the order is treated as placed before the money moves. So a customer who abandons at the
gateway still gets "order placed".

**Fix:** for online methods, fire the confirmation notification from the **payment webhook**
(`markOrderPaid`), not from order creation. Offline methods keep notifying at placement.

## P1 — inline field validation (owner item 3)
Missing/invalid checkout fields must show a red message **below the offending field** and outline it
red. Today the feedback is not at the field. Needs `aria-invalid` + `aria-describedby` on each field
so screen readers get it too, and it must work in AR/RTL.

## P1 — numeric-only order numbers (owner item 4)
Currently `VY-MRVZHS69-698`. Owner wants purely numeric.
⚠️ Order number is **half of YeldnIN's idempotency key** and is echoed to Kashier/OPay as `order`
and matched back by the webhook — so this is not a cosmetic change. Needs: a sequence/counter,
uniqueness per store, a decision on whether existing `VY-`/`EV-` numbers are migrated or left, and a
check on everything that parses the prefix.

## P1 — save address to account on order (owner item 5)
A logged-in customer's checkout details should persist to their account automatically, so they are
not re-typed next time. Check whether `Address` is already created and only the default-flag is
missing.

## P2 — guest → account creation (owner item 6)
Offer account creation at guest checkout, save the details to it, and email a set-password link.
**Blocked on nothing now — SMTP works** (Brevo, verified 2026-07-22). Must not set a password
server-side; send a set-password token. Watch the existing `User`/`Customer` email-match logic so a
guest whose email already exists is linked rather than duplicated.

## P2 — collapse the coupon field (owner item 7)
"Have a discount code?" with a chevron, collapsed by default, expanding to the input. A visible
empty coupon box invites hunting for a code and abandoning the cart.

---

## Still open from the same session
- **Kashier test-environment keys** — the stored keys are LIVE; with Environment on Test the API
  returns `API Key Not Found`. Live works (proven by the successful order).
- **OPay is completely unproven** — no checkout call has ever reached it. Both test orders routed to
  Kashier. Verified so far: Egypt host (`api`/`sandboxapi.opaycheckout.com`), merchant id, public
  key, webhook registered. Unverified: the private-key HMAC status query and `buildOpayRedirect`.
  Sandbox needs separate OPay-issued credentials — live keys return `00003 merchant is null` there.
- ⚠️ Keep `payments.cardGateway` on `kashier` or `auto` until OPay completes a real transaction.

## Payment methods — do NOT delete the 11 SystemPaymentMethod rows
The owner asked whether the shipping/payment "couples" are still needed. They are, and they are not
duplicates: 11 system methods collapse to **6 customer-facing** ones via `customerCode`
(COD ×3, CARD ×2, POS ×3, BANK/WALLET ×3). `sourceAliases` maps every legacy WooCommerce payment
string so ~21k imported orders keep their method; `courier` on the three COD rows carries the
operational difference (own rider vs Aramex vs SMSA) that the customer never sees. Deleting them
breaks historical attribution. If checkout shows 11 options, the grouping by `customerCode` is
broken — fix that, don't delete rows.
