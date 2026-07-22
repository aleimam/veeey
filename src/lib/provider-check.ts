import 'server-only';
import { getOpayConfig, getKashierConfig, getAramexConfig, getSmsaConfig, getWhatsappConfig, getAiConfig } from '@/lib/provider-config';
import { opaySignature, opayBaseUrl } from '@/lib/payment-crypto';

/**
 * Live connection checks for external providers (admin → Providers). Each check
 * makes a real but harmless API call with the stored credentials and reports
 * what the provider answered — `ok` (credentials accepted), `fail` (rejected),
 * `warn` (reached, response inconclusive), `skip` (not configured).
 */
export type ProviderCheck = { status: 'ok' | 'warn' | 'fail' | 'skip'; code?: string; detail?: string };
export type CheckableProvider = 'opay' | 'kashier' | 'aramex' | 'smsa' | 'whatsapp' | 'ai';

const clip = (s: unknown, n = 140) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);
const TIMEOUT = 12_000;

/** OPay: create a 1-EGP throwaway cashier session (validates merchantId +
 *  public key on the exact endpoint checkout uses), then status-query it
 *  (validates the private key the webhook confirmation signs with). The
 *  session is never paid and expires on its own. */
export async function checkOpay(): Promise<ProviderCheck> {
  const cfg = await getOpayConfig();
  if (!cfg) return { status: 'skip' };
  const base = opayBaseUrl(cfg.environment);
  const reference = `CONNCHECK-${Date.now()}`;
  try {
    const createRes = await fetch(`${base}/api/v1/international/cashier/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${cfg.publicKey}`, MerchantId: cfg.merchantId },
      body: JSON.stringify({
        country: 'EG',
        reference,
        amount: { total: 100, currency: 'EGP' }, // 1 EGP, never paid
        returnUrl: 'https://veeey.com',
        callbackUrl: 'https://veeey.com/api/payments/webhook/opay',
        cancelUrl: 'https://veeey.com',
        expireAt: 5,
        product: { name: 'Connection check', description: 'Connection check' },
        userInfo: { userId: 'conncheck', userName: 'Connection check', userMobile: '', userEmail: '' },
        customerVisitSource: 'BROWSER',
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const created = (await createRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (created?.code !== '00000') {
      return { status: 'fail', code: created?.code ?? String(createRes.status), detail: clip(created?.message) };
    }
    // Public key OK — now exercise the private-key (HMAC) status endpoint.
    const payload = JSON.stringify({ country: 'EG', reference });
    const statusRes = await fetch(`${base}/api/v1/international/cashier/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${opaySignature(payload, cfg.privateKey)}`, MerchantId: cfg.merchantId },
      body: payload,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const status = (await statusRes.json().catch(() => null)) as { code?: string; message?: string } | null;
    if (status?.code === '00000') return { status: 'ok' };
    return { status: 'warn', code: status?.code ?? String(statusRes.status), detail: clip(`public key OK; private-key status query: ${status?.message ?? ''}`) };
  } catch (e) {
    return { status: 'fail', code: 'network', detail: clip(e instanceof Error ? e.message : e) };
  }
}

/**
 * Kashier: order-inquiry API, authenticated with the **SECRET key**.
 *
 * Kashier splits the two credentials and they are not interchangeable: the API
 * key signs the hosted-payment hash, the secret key authenticates
 * server-to-server calls. Sending the API key here returns 401 "Token
 * validation failed / Session expired" — a dashboard-session error that reads
 * like the credentials are wrong when they are perfectly good.
 *
 * A valid key on an order that doesn't exist answers **200** with
 * `status: FAILURE, "Order is not exist"`. That is a PASS: it proves the key was
 * accepted and the API answered. Only 401/403 means the credential is bad.
 */
export async function checkKashier(): Promise<ProviderCheck> {
  const cfg = await getKashierConfig();
  if (!cfg) return { status: 'skip' };
  if (!cfg.secretKey) return { status: 'fail', code: 'no_secret', detail: 'Secret key is required for the API check' };
  try {
    const res = await fetch(`https://api.kashier.io/payments/orders/CONNCHECK-${Date.now()}`, {
      headers: { Authorization: cfg.secretKey, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = clip(await res.text().catch(() => ''));
    if (res.status === 401 || res.status === 403) return { status: 'fail', code: String(res.status), detail: body };
    if (res.status === 200 || res.status === 404) return { status: 'ok', code: String(res.status) };
    return { status: 'warn', code: String(res.status), detail: body };
  } catch (e) {
    return { status: 'fail', code: 'network', detail: clip(e instanceof Error ? e.message : e) };
  }
}

/** Aramex: minimal domestic rate calculation. Auth failures come back as
 *  ClientInfo notifications; any successful rate (or a non-auth data
 *  notification) proves the account credentials work. */
export async function checkAramex(): Promise<ProviderCheck> {
  const cfg = await getAramexConfig();
  if (!cfg) return { status: 'skip' };
  const host = cfg.environment === 'live' ? 'ws.aramex.net' : 'ws.dev.aramex.net';
  try {
    const res = await fetch(`https://${host}/ShippingAPI.V2/RateCalculator/Service_1_0.svc/json/CalculateRate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ClientInfo: {
          UserName: cfg.username, Password: cfg.password, Version: 'v1.0',
          AccountNumber: cfg.accountNumber, AccountPin: cfg.accountPin,
          AccountEntity: cfg.accountEntity, AccountCountryCode: cfg.accountCountryCode,
        },
        OriginAddress: { City: 'Cairo', CountryCode: 'EG' },
        DestinationAddress: { City: 'Alexandria', CountryCode: 'EG' },
        ShipmentDetails: {
          PaymentType: 'P', ProductGroup: 'DOM', ProductType: 'OND',
          ActualWeight: { Value: 1, Unit: 'KG' }, ChargeableWeight: { Value: 1, Unit: 'KG' }, NumberOfPieces: 1,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const json = (await res.json().catch(() => null)) as { HasErrors?: boolean; Notifications?: { Code?: string; Message?: string }[] } | null;
    if (!json) return { status: 'warn', code: String(res.status), detail: 'non-JSON response' };
    if (!json.HasErrors) return { status: 'ok' };
    const notes = (json.Notifications ?? []).map((n) => `${n.Code}: ${n.Message}`).join(' | ');
    const authError = /client\s?info|authent|login|password|account/i.test(notes);
    return authError
      ? { status: 'fail', code: json.Notifications?.[0]?.Code, detail: clip(notes) }
      : { status: 'warn', code: json.Notifications?.[0]?.Code, detail: clip(`credentials accepted; data notice: ${notes}`) };
  } catch (e) {
    return { status: 'fail', code: 'network', detail: clip(e instanceof Error ? e.message : e) };
  }
}

/** SMSA: tracking lookup for a dummy AWB. REST eCom API when an API key is
 *  stored (401/403 = bad key); legacy SOAP passkey otherwise. */
export async function checkSmsa(): Promise<ProviderCheck> {
  const cfg = await getSmsaConfig();
  if (!cfg) return { status: 'skip' };
  try {
    if (cfg.apiKey) {
      const host = cfg.environment === 'live' ? 'ecomapis.smsaexpress.com' : 'ecomapis-sandbox.smsaexpress.com';
      const res = await fetch(`https://${host}/api/Tracking?awbs=00000000000`, {
        headers: { apikey: cfg.apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const body = clip(await res.text().catch(() => ''));
      if (res.status === 401 || res.status === 403) return { status: 'fail', code: String(res.status), detail: body };
      if (res.ok || res.status === 404) return { status: 'ok', code: String(res.status) };
      return { status: 'warn', code: String(res.status), detail: body };
    }
    // Legacy passkey (SOAP web service, GET form).
    const res = await fetch(`https://track.smsaexpress.com/SECOM/SMSAwebService.asmx/getTracking?awbNo=0&passkey=${encodeURIComponent(cfg.passKey)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = await res.text().catch(() => '');
    if (/invalid|not valid|wrong/i.test(body)) return { status: 'fail', code: String(res.status), detail: clip(body) };
    if (res.ok) return { status: 'warn', code: String(res.status), detail: 'legacy passkey reached SMSA; response inconclusive for a dummy AWB' };
    return { status: 'warn', code: String(res.status), detail: clip(body) };
  } catch (e) {
    return { status: 'fail', code: 'network', detail: clip(e instanceof Error ? e.message : e) };
  }
}

/** WhatsApp: read the configured phone-number ID's verified_name from the Meta
 *  Graph API — proves both the token and the phone-number ID are valid. */
export async function checkWhatsapp(): Promise<ProviderCheck> {
  const cfg = await getWhatsappConfig();
  if (!cfg) return { status: 'skip' };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(cfg.sender)}?fields=verified_name,display_phone_number`, {
      headers: { authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const json = (await res.json().catch(() => null)) as { verified_name?: string; error?: { code?: number; message?: string } } | null;
    if (res.ok && json && !json.error) return { status: 'ok', detail: clip(json.verified_name) };
    return { status: 'fail', code: String(json?.error?.code ?? res.status), detail: clip(json?.error?.message) };
  } catch (e) {
    return { status: 'fail', code: 'network', detail: clip(e instanceof Error ? e.message : e) };
  }
}

/** AI (Anthropic): a 1-token message ping. 200 = key + model OK; 401 = bad key. */
export async function checkAi(): Promise<ProviderCheck> {
  const cfg = await getAiConfig();
  if (!cfg) return { status: 'skip' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.ok) return { status: 'ok' };
    const json = (await res.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null;
    // A model-name error still proves the API key is valid.
    if (res.status === 404 || /model/i.test(json?.error?.message ?? '')) return { status: 'warn', code: String(res.status), detail: clip(`key OK; ${json?.error?.message ?? ''}`) };
    return { status: 'fail', code: json?.error?.type ?? String(res.status), detail: clip(json?.error?.message) };
  } catch (e) {
    return { status: 'fail', code: 'network', detail: clip(e instanceof Error ? e.message : e) };
  }
}

export async function checkProvider(p: CheckableProvider): Promise<ProviderCheck> {
  switch (p) {
    case 'opay': return checkOpay();
    case 'kashier': return checkKashier();
    case 'aramex': return checkAramex();
    case 'smsa': return checkSmsa();
    case 'whatsapp': return checkWhatsapp();
    case 'ai': return checkAi();
  }
}
