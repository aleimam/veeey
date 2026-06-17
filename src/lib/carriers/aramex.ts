import 'server-only';
import { getAramexConfig } from '@/lib/provider-config';
import { getSetting } from '@/lib/settings-service';

/**
 * Aramex Shipping Services API (FR-SHIP). Create a shipment → AWB + label URL,
 * and track by AWB. JSON endpoints with a ClientInfo auth block. Credentials are
 * admin-configured (Admin → Providers). Field shapes are the documented Aramex
 * ones; confirm exact requirements against your test account on first use.
 */
const host = () => 'https://ws.aramex.net';
const CREATE_URL = `${host()}/ShippingAPI.V2/Shipping/Service_1_0.svc/json/CreateShipments`;
const TRACK_URL = `${host()}/ShippingAPI.V2/Tracking/Service_1_0.svc/json/TrackShipments`;

type Addr = { name?: string; phone?: string; governorate?: string; city?: string; street?: string };
export type ShipOrder = { number: string; totalPiastres: bigint; paymentMethod: string | null; shippingAddressJson: unknown };
export type ShipResult = { ok: true; awb: string; labelUrl: string | null } | { ok: false; error: string };
export type TrackUpdate = { date: string; status: string; location: string };

type AramexJson = {
  HasErrors?: boolean;
  Notifications?: { Message?: string }[];
  Shipments?: { ID?: string; ShipmentLabel?: { LabelURL?: string }; Notifications?: { Message?: string }[] }[];
  TrackingResults?: { Value?: { UpdateDateTime?: string; UpdateDescription?: string; UpdateLocation?: string }[] }[];
};

type Cfg = NonNullable<Awaited<ReturnType<typeof getAramexConfig>>>;
const clientInfo = (cfg: Cfg) => ({
  UserName: cfg.username,
  Password: cfg.password,
  Version: 'v1.0',
  AccountNumber: cfg.accountNumber,
  AccountPin: cfg.accountPin,
  AccountEntity: cfg.accountEntity,
  AccountCountryCode: cfg.accountCountryCode,
  Source: 24,
});

export async function createAramexShipment(order: ShipOrder): Promise<ShipResult> {
  const cfg = await getAramexConfig();
  if (!cfg) return { ok: false, error: 'aramex_not_configured' };
  const a = (order.shippingAddressJson ?? {}) as Addr;
  const [storeEmail, storePhone, storeAddr] = await Promise.all([
    getSetting('store.contactEmail'),
    getSetting('store.phone'),
    getSetting('store.addressEn'),
  ]);
  const cod = order.paymentMethod === 'COD' ? Number(order.totalPiastres) / 100 : 0;

  const body = {
    ClientInfo: clientInfo(cfg),
    Transaction: { Reference1: order.number },
    Shipments: [{
      Reference1: order.number,
      Shipper: {
        Reference1: 'Veeey',
        AccountNumber: cfg.accountNumber,
        PartyAddress: { Line1: storeAddr || 'Cairo', City: 'Cairo', CountryCode: cfg.accountCountryCode },
        Contact: { PersonName: 'Veeey', CompanyName: 'Veeey', PhoneNumber1: storePhone || '0000000000', CellPhone: storePhone || '0000000000', EmailAddress: storeEmail || 'info@veeey.com' },
      },
      Consignee: {
        PartyAddress: { Line1: a.street || '-', City: a.city || a.governorate || '-', CountryCode: cfg.accountCountryCode },
        Contact: { PersonName: a.name || 'Customer', CompanyName: a.name || 'Customer', PhoneNumber1: a.phone || '0000000000', CellPhone: a.phone || '0000000000', EmailAddress: '' },
      },
      ShippingDateTime: `/Date(${Date.now()})/`,
      Details: {
        ActualWeight: { Value: 1, Unit: 'KG' },
        ProductGroup: 'DOM',
        ProductType: 'OND',
        PaymentType: 'P',
        NumberOfPieces: 1,
        DescriptionOfGoods: 'Health products',
        GoodsOriginCountry: cfg.accountCountryCode,
        ...(cod > 0 ? { CashOnDeliveryAmount: { Value: cod, CurrencyCode: 'EGP' } } : {}),
      },
    }],
    LabelInfo: { ReportID: 9201, ReportType: 'URL' },
  };

  try {
    const res = await fetch(CREATE_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as AramexJson | null;
    if (!json) return { ok: false, error: `http_${res.status}` };
    if (json.HasErrors) {
      const msg = json.Notifications?.[0]?.Message || json.Shipments?.[0]?.Notifications?.[0]?.Message || 'aramex_error';
      return { ok: false, error: String(msg).slice(0, 160) };
    }
    const ship = json.Shipments?.[0];
    if (!ship?.ID) return { ok: false, error: 'no_awb_returned' };
    return { ok: true, awb: String(ship.ID), labelUrl: ship.ShipmentLabel?.LabelURL ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : 'aramex_error' };
  }
}

export async function trackAramex(awb: string): Promise<{ ok: boolean; updates?: TrackUpdate[]; error?: string }> {
  const cfg = await getAramexConfig();
  if (!cfg) return { ok: false, error: 'aramex_not_configured' };
  try {
    const res = await fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ClientInfo: clientInfo(cfg), Shipments: [awb], GetLastTrackingUpdateOnly: false }),
    });
    const json = (await res.json().catch(() => null)) as AramexJson | null;
    const values = json?.TrackingResults?.[0]?.Value ?? [];
    return { ok: true, updates: values.map((u) => ({ date: u.UpdateDateTime ?? '', status: u.UpdateDescription ?? '', location: u.UpdateLocation ?? '' })) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : 'track_error' };
  }
}
