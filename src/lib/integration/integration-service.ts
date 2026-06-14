import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { signRequest, verifyRequest } from '@/lib/integration/hmac-logic';
import { integrationEnabled, integrationSecret, yeldninBaseUrl, VEEEY_CLIENT_ID, BACKOFF_MS, OUTBOX_PATHS } from '@/lib/integration/config';

/** Record a domain event for outbound delivery to YeldnIN. No-op when the flag is
 *  off (contract: no events while disabled — avoids a stale backlog). */
export async function recordOutbox(type: string, aggregateId: string | null, payload: object) {
  if (!integrationEnabled()) return null;
  return prisma.outboxEvent.create({ data: { type, aggregateId, payloadJson: payload as object } });
}

function backoff(attempts: number): { status: 'FAILED' | 'DEAD'; nextAttemptAt: Date | null } {
  if (attempts >= BACKOFF_MS.length) return { status: 'DEAD', nextAttemptAt: null };
  return { status: 'FAILED', nextAttemptAt: new Date(Date.now() + BACKOFF_MS[attempts]) };
}

/** Sign + POST due outbox events to YeldnIN. No-op when the flag/secret is absent. */
export async function dispatchOutbox(limit = 20): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const secret = integrationSecret();
  if (!integrationEnabled() || !secret) return { sent: 0, failed: 0, skipped: true };

  const now = new Date();
  const events = await prisma.outboxEvent.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const ev of events) {
    const path = OUTBOX_PATHS[ev.type];
    if (!path) {
      await prisma.outboxEvent.update({ where: { id: ev.id }, data: { status: 'DEAD', lastError: 'unknown_type' } });
      failed += 1;
      continue;
    }
    const canonicalPath = `/api/integration/v1${path}`;
    const body = JSON.stringify(ev.payloadJson);
    const ts = String(Date.now());
    const nonce = randomUUID();
    const sig = signRequest(secret, 'POST', canonicalPath, ts, nonce, body);
    try {
      const res = await fetch(`${yeldninBaseUrl()}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Client-Id': VEEEY_CLIENT_ID, 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Signature': sig, 'Idempotency-Key': ev.id },
        body,
      });
      if (res.ok) {
        await prisma.outboxEvent.update({ where: { id: ev.id }, data: { status: 'SENT', sentAt: new Date(), attempts: ev.attempts + 1, lastError: null } });
        sent += 1;
      } else {
        await prisma.outboxEvent.update({ where: { id: ev.id }, data: { ...backoff(ev.attempts + 1), attempts: ev.attempts + 1, lastError: `http_${res.status}` } });
        failed += 1;
      }
    } catch (e) {
      await prisma.outboxEvent.update({ where: { id: ev.id }, data: { ...backoff(ev.attempts + 1), attempts: ev.attempts + 1, lastError: e instanceof Error ? e.message.slice(0, 100) : 'error' } });
      failed += 1;
    }
  }
  return { sent, failed, skipped: false };
}

// ---- Inbound (YeldnIN → Veeey webhook) ------------------------------------

/** Insert the nonce; false if it already existed (replay). */
async function recordNonceOnce(nonce: string, clientId: string): Promise<boolean> {
  try {
    await prisma.integrationNonce.create({ data: { nonce, clientId } });
    return true;
  } catch {
    return false;
  }
}

export type InboundResult = { ok: true } | { ok: false; code: string };

export async function verifyInbound(opts: {
  method: string;
  path: string;
  rawBody: string;
  headers: { clientId?: string | null; timestamp?: string | null; nonce?: string | null; signature?: string | null };
  nowMs: number;
}): Promise<InboundResult> {
  const secret = integrationSecret();
  if (!secret) return { ok: false, code: 'integration_disabled' };
  const r = verifyRequest({ secret, method: opts.method, path: opts.path, headers: opts.headers, rawBody: opts.rawBody, nowMs: opts.nowMs });
  if (!r.ok) return { ok: false, code: r.code };
  if (!(await recordNonceOnce(opts.headers.nonce!, opts.headers.clientId ?? 'unknown'))) return { ok: false, code: 'nonce_replayed' };
  return { ok: true };
}

// ---- Idempotency (inbound mutations) --------------------------------------

export async function checkIdempotency(key: string, endpoint: string): Promise<{ replay: true; statusCode: number; body: unknown } | { replay: false; reused: boolean }> {
  const rec = await prisma.idempotencyRecord.findUnique({ where: { key } });
  if (!rec) return { replay: false, reused: false };
  if (rec.endpoint !== endpoint) return { replay: false, reused: true };
  return { replay: true, statusCode: rec.statusCode, body: rec.responseJson };
}

export async function saveIdempotency(key: string, endpoint: string, statusCode: number, body: unknown) {
  await prisma.idempotencyRecord.create({ data: { key, endpoint, statusCode, responseJson: body as object } }).catch(() => {});
}

export const listOutbox = (limit = 100) => prisma.outboxEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
