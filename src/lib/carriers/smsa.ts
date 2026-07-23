import 'server-only';
import { getSmsaConfig } from '@/lib/provider-config';
import { resolveAwb, type AwbEdit, type AwbAddr } from '@/lib/carriers/awb';

/**
 * SMSA Express SOAP web service (FR-SHIP). addShipment → AWB, getTracking → events,
 * getPDF → label bytes. Auth via passKey (Admin → Providers). SOAP endpoint:
 * https://track.smsaexpress.com/SECOM/SMSAwebService.asmx (namespace …/secom/).
 * Field shapes per the published WSDL; confirm against your test passKey on first use.
 */
const ENDPOINT = 'https://track.smsaexpress.com/SECOM/SMSAwebService.asmx';
const NS = 'http://track.smsaexpress.com/secom/';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tag = (name: string, val: unknown) => `<${name}>${esc(val)}</${name}>`;
const extract = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : null;
};

async function soap(action: string, inner: string): Promise<string | null> {
  const body = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${action} xmlns="${NS}">${inner}</${action}></soap:Body></soap:Envelope>`;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8', SOAPAction: `"${NS}${action}"` },
      body,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export type SmsaOrder = { number: string; totalPiastres: bigint; paymentMethod: string | null; shippingAddressJson: unknown };
export type SmsaResult = { ok: true; awb: string } | { ok: false; error: string };
export type TrackUpdate = { date: string; status: string; location: string };

export async function createSmsaShipment(order: SmsaOrder, edit?: AwbEdit): Promise<SmsaResult> {
  const cfg = await getSmsaConfig();
  if (!cfg?.passKey) return { ok: false, error: 'smsa_passkey_missing' };
  // Staff-reviewed values win over the stored snapshot (shared resolver). Egypt
  // domestic: cntry EG, currencies EGP (this endpoint is SMSA's shared SECOM service).
  const autoCod = order.paymentMethod === 'COD' ? Number(order.totalPiastres) / 100 : 0;
  const r = resolveAwb((order.shippingAddressJson ?? {}) as AwbAddr, edit, autoCod);
  const inner = [
    tag('passKey', cfg.passKey), tag('refNo', order.number), tag('sentDate', new Date().toISOString().slice(0, 10)),
    tag('idNo', ''), tag('cName', r.name), tag('cntry', 'EG'), tag('cCity', r.city),
    tag('cZip', ''), tag('cPOBox', ''), tag('cMobile', r.phone), tag('cTel1', ''), tag('cTel2', ''),
    tag('cAddr1', r.street), tag('cAddr2', r.gov), tag('shipType', 'DLV'), tag('PCs', String(r.pieces)),
    tag('cEmail', ''), tag('carrValue', '0'), tag('carrCurr', 'EGP'), tag('codAmt', r.cod), tag('weight', String(r.weightKg)),
    tag('custVal', '0'), tag('custCurr', 'EGP'), tag('insrAmt', '0'), tag('insrCurr', 'EGP'),
    tag('itemDesc', r.contents), tag('ShortCode', ''),
  ].join('');
  const xml = await soap('addShipment', inner);
  if (!xml) return { ok: false, error: 'smsa_unreachable' };
  const result = (extract(xml, 'addShipmentResult') ?? '').trim();
  if (/^\d{6,}$/.test(result)) return { ok: true, awb: result }; // success returns the AWB number
  return { ok: false, error: (result || 'smsa_error').slice(0, 160) };
}

export async function trackSmsa(awb: string): Promise<{ ok: boolean; updates?: TrackUpdate[]; error?: string }> {
  const cfg = await getSmsaConfig();
  if (!cfg?.passKey) return { ok: false, error: 'smsa_passkey_missing' };
  const xml = await soap('getTracking', tag('awbNo', awb) + tag('passKey', cfg.passKey));
  if (!xml) return { ok: false, error: 'smsa_unreachable' };
  const updates: TrackUpdate[] = [];
  for (const row of xml.match(/<Tracking>[\s\S]*?<\/Tracking>/g) ?? []) {
    updates.push({ date: extract(row, 'Date') ?? '', status: extract(row, 'Activity') ?? '', location: extract(row, 'Location') ?? '' });
  }
  return { ok: true, updates: updates.reverse() };
}

/** Label PDF bytes for an AWB (getPDF returns base64). */
export async function getSmsaLabelPdf(awb: string): Promise<Buffer | null> {
  const cfg = await getSmsaConfig();
  if (!cfg?.passKey) return null;
  const xml = await soap('getPDF', tag('awbNo', awb) + tag('passKey', cfg.passKey));
  if (!xml) return null;
  const b64 = (extract(xml, 'getPDFResult') ?? '').trim();
  if (!b64) return null;
  try {
    return Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
}
