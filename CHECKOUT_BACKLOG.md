# Checkout backlog — owner feedback 2026-07-22 (after the first successful Kashier payment)

✅ **BOTH GATEWAYS PROVEN by real transactions.** Kashier v3 (Payment Sessions migration + secret-key auth + `serverWebhook`) and OPay (Egypt host `api.opaycheckout.com`) each completed a real paid order.

> **✅ ALL ITEMS BELOW SHIPPED 2026-07-22** (commits `92db6c1` migration → `f54dd8e` P0 →
> `259a757` P1 → `d7e1c0b` P2; migration `20260722210000_checkout_payment_flow` = 72nd).
> How each landed:
> - **P0 (one root cause, one fix):** online card orders now open in **AWAITING_PAYMENT** —
>   hidden from the default admin list, excluded from analytics, NO notifications. The payment
>   webhook promotes to PENDING and only then fires the placed email/SMS/WhatsApp. A failed
>   session, a gateway cancel and a still-unpaid return all land on the confirmation page as a
>   **payment screen** (⏳, honest banner, **Pay now** retry that opens a fresh session for the
>   same order). A worker sweep (*/5) cancels + **restocks** orders unpaid past
>   Setting `payments.awaitingAutoCancelMinutes` (default 35 > Kashier's 30-min session) —
>   silently, since those customers were never told "placed". A payment landing after the
>   cancel is flagged `payCheck=PROBLEM`, never swallowed.
> - **P1:** numeric order numbers from a per-store sequence (existing VY-/EV- numbers kept —
>   they're echoed to the gateways and are half of YeldnIN's (storeKey, orderNumber) key);
>   inline red under-field validation with aria wiring; checkout pre-fills the default saved
>   address and placeOrder find-or-creates instead of duplicating the address book.
> - **P2:** guest "Create an account" checkbox → account + emailed single-use hashed
>   set-password link (`/set-password`; server never invents a password; existing emails are
>   NOT auto-linked — sign-in prompt instead); coupon field collapsed behind
>   "Have a discount code?".
> The two artefact orders below were cancelled at deploy (stock restored).

Items below are in the order I'd do them: correctness first, then UX. (Kept for the record.)

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

## 🔴 P0 — cancelling at the gateway still leaves an order behind
Third symptom of the same root cause, found on the owner's OPay run: cancelling the payment left the
order placed with payment FAILED. So abandoning at the gateway still produces an order.

**The real cost is stock.** Stock leaves at placement, so every abandoned card attempt holds
inventory hostage — on a store that oversells easily (ev.net sells the same pool) that matters more
than the untidy order list.

**Recommended handling — do NOT hard-cancel instantly.** The customer may have mis-clicked, or may
retry. Better:
- Keep the order in an explicit **unpaid/awaiting-payment** state that is excluded from the normal
  order list and sends NO notifications.
- Give it a retry link back to a fresh payment session.
- Let the expiry sweep cancel it and **restore stock** once the gateway session expires (30 min for
  Kashier v3), which is the natural deadline and needs no new timer.

That way a genuine retry works, stock comes back on its own, and Sales never sees a phantom order.
An instant hard-cancel is simpler but strands anyone who cancels by accident.

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
- **OPay ✅ proven on LIVE** — a real order paid through it. Egypt host, merchant id, public key,
  webhook and `buildOpayRedirect` all validated end to end. **Sandbox still needs separate
  OPay-issued credentials** — live keys return `00003 merchant is null` there.
- Both gateways are now safe to leave selectable; `payments.cardGateway` no longer needs pinning.

## Payment methods — do NOT delete the 11 SystemPaymentMethod rows
The owner asked whether the shipping/payment "couples" are still needed. They are, and they are not
duplicates: 11 system methods collapse to **6 customer-facing** ones via `customerCode`
(COD ×3, CARD ×2, POS ×3, BANK/WALLET ×3). `sourceAliases` maps every legacy WooCommerce payment
string so ~21k imported orders keep their method; `courier` on the three COD rows carries the
operational difference (own rider vs Aramex vs SMSA) that the customer never sees. Deleting them
breaks historical attribution. If checkout shows 11 options, the grouping by `customerCode` is
broken — fix that, don't delete rows.
