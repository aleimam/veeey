/**
 * The sentence shown under a payment method once the customer selects it.
 *
 * Pure and standalone so both `settings-service` (which registers these as
 * editable settings) and `payment-method-service` (which reads them) can use it
 * without importing each other.
 *
 * These are DEFAULTS, not fixed strings: they carry details that change without
 * a release — the wallet number, the IPN address, which bank — so the owner
 * edits them in Settings → Payments.
 */
export const paymentDescriptionKey = (code: string, locale: string) =>
  `payments.desc.${code}.${locale === 'ar' ? 'ar' : 'en'}`;

/**
 * The checkout display order (owner 2026-07-23): cards first, then the transfer
 * rails, POS, and COD last. Pure + here so the service can be sorted by it and
 * vitest can assert it (the service itself drags in next-auth and won't load in
 * tests). Note: this is DISPLAY order only — the pre-selected default is COD,
 * decided in the checkout form, so leading with cards never auto-switches a
 * shopper onto an online payment.
 */
export const CHECKOUT_METHOD_ORDER = [
  'CARD_KASHIER', 'CARD_OPAY', 'INSTAPAY', 'BANK_TRANSFER', 'MOBILE_WALLET', 'POS_ON_DELIVERY', 'COD',
] as const;

/**
 * A method's logo is an uploaded image URL kept in Settings, per method.
 *
 * The images themselves are owner-supplied: the real Visa/MasterCard, Kashier,
 * OPay, InstaPay and wallet-brand marks are trademarks, so the store must upload
 * the official artwork (Admin → Payments) rather than have anything fabricate an
 * imitation. Until a logo is uploaded, checkout falls back to the generic
 * type-icon below.
 */
export const paymentLogoKey = (code: string) => `payments.logo.${code}`;

/**
 * Generic, brand-NEUTRAL fallback icon per method (a Lucide glyph in the
 * storefront Icon set) — shown only when no official logo has been uploaded.
 * A card icon for a card, a wallet for a wallet: communicates the payment TYPE
 * without standing in for a brand mark.
 */
export const PAYMENT_FALLBACK_ICON: Record<string, string> = {
  CARD_KASHIER: 'credit-card',
  CARD_OPAY: 'credit-card',
  INSTAPAY: 'send',
  BANK_TRANSFER: 'landmark',
  MOBILE_WALLET: 'wallet',
  POS_ON_DELIVERY: 'credit-card',
  COD: 'banknote',
};

/** Says what the customer must DO, not what the method is. */
export const PAYMENT_DESCRIPTION_DEFAULTS: Record<string, { en: string; ar: string }> = {
  COD: {
    en: 'Pay the courier in cash when your order arrives.',
    ar: 'ادفع نقدًا للمندوب عند وصول طلبك.',
  },
  // The owner chose text over logos (2026-07-23), so the four wallets are NAMED
  // here — otherwise a shopper cannot tell whether their own wallet is accepted.
  MOBILE_WALLET: {
    en: 'Send the total from Vodafone Cash, Orange Cash, Etisalat Flous or WE Pay. We will send you the number and confirm your transfer before dispatch.',
    ar: 'حوّل الإجمالي من فودافون كاش أو أورنچ كاش أو اتصالات فلوس أو WE Pay. سنرسل لك الرقم ونؤكد التحويل قبل الشحن.',
  },
  INSTAPAY: {
    en: 'Transfer from any Egyptian bank app using InstaPay (IPN). We will send you our IPN address and confirm your transfer before dispatch.',
    ar: 'حوّل من تطبيق أي بنك مصري عبر إنستاباي (IPN). سنرسل لك عنوان الـ IPN ونؤكد التحويل قبل الشحن.',
  },
  BANK_TRANSFER: {
    en: 'Transfer to our bank account and send us the receipt. We confirm the transfer before dispatch.',
    ar: 'حوّل إلى حسابنا البنكي وأرسل لنا الإيصال. نؤكد التحويل قبل الشحن.',
  },
  CARD_OPAY: {
    en: 'Pay now by Visa or MasterCard on our secure payment page.',
    ar: 'ادفع الآن بفيزا أو ماستركارد على صفحة الدفع الآمنة.',
  },
  CARD_KASHIER: {
    en: 'Pay now by Visa or MasterCard on our secure payment page.',
    ar: 'ادفع الآن بفيزا أو ماستركارد على صفحة الدفع الآمنة.',
  },
  // Both halves of the owner's rule are stated: WHERE it works, and that it is
  // not guaranteed. A customer who picks it and then hears "no machine today"
  // on the phone should have read it here first.
  POS_ON_DELIVERY: {
    en: 'Pay by card on the courier’s machine at your door. Cairo and Giza only, and subject to a machine being available — our team confirms when they call you.',
    ar: 'ادفع بالبطاقة على ماكينة المندوب عند الباب. القاهرة والجيزة فقط، ورهن توفّر الماكينة — يؤكد فريقنا عند الاتصال بك.',
  },
};

/** Admin label for the settings row, e.g. "Mobile Wallet — description (AR)". */
export const PAYMENT_DESCRIPTION_LABELS: Record<string, string> = {
  COD: 'Cash on Delivery',
  MOBILE_WALLET: 'Mobile Wallet',
  INSTAPAY: 'InstaPay (IPN)',
  BANK_TRANSFER: 'Bank Transfer',
  CARD_OPAY: 'Card (OPay)',
  CARD_KASHIER: 'Card (Kashier)',
  POS_ON_DELIVERY: 'POS upon Delivery',
};

/**
 * These descriptions as editable settings rows — generated, not hand-written,
 * so the wording above and the settings registry cannot drift apart.
 *
 * ⚠️ The `default` is the REAL sentence, never ''. `saveSettings` upserts every
 * known key, so a blank default would wipe all seven descriptions the first time
 * anyone pressed Save on the settings page.
 *
 * `SettingDef` is imported as a TYPE only: the value side of settings-service
 * pulls in auth-guards → next-auth, and this module must stay loadable in tests.
 */
/**
 * The uploaded-logo URLs as editable settings rows — one per customer method.
 * Registered so the config transfer carries them and the admin's upload writes a
 * known key. Default '' = fall back to the generic type-icon.
 */
export function paymentLogoSettings(): Array<{
  key: string; label: string; group: string; type: 'text'; default: string; hint: string;
}> {
  return Object.entries(PAYMENT_DESCRIPTION_LABELS).map(([code, label]) => ({
    key: paymentLogoKey(code),
    label: `${label} — logo`,
    group: 'Payments',
    type: 'text' as const,
    default: '',
    hint: 'URL of the official payment logo shown at checkout (upload it on the Payments admin page). Empty = a generic type-icon is shown instead.',
  }));
}

export function paymentDescriptionSettings(): Array<{
  key: string; label: string; group: string; type: 'text'; default: string; hint: string;
}> {
  return Object.entries(PAYMENT_DESCRIPTION_LABELS).flatMap(([code, label]) =>
    (['en', 'ar'] as const).map((loc) => ({
      key: paymentDescriptionKey(code, loc),
      label: `${label} — description (${loc.toUpperCase()})`,
      group: 'Payments',
      type: 'text' as const,
      default: PAYMENT_DESCRIPTION_DEFAULTS[code]?.[loc] ?? '',
      hint: 'Shown under this method at checkout when the customer selects it. Put the wallet number / IPN address / bank account here. Empty = nothing shown.',
    })),
  );
}
