// Local mock of YeldnIN's inbound API (INTEGRATION_CONTRACT §1). Verifies the
// Veeey HMAC signature and logs/acks requests, so the outbox dispatcher can be
// developed without a live YeldnIN. Run: `npm run mock:yeldnin`.
import { createServer } from 'node:http';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.INTEGRATION_CLIENT_VEEEY_SECRET ?? '';
const PORT = Number(process.env.MOCK_PORT ?? 4500);

const sha256hex = (b) => createHash('sha256').update(b, 'utf8').digest('hex');
const sign = (method, path, ts, nonce, body) =>
  createHmac('sha256', SECRET).update([method.toUpperCase(), path, ts, nonce, sha256hex(body)].join('\n')).digest('hex');

createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    // Canonical path is the request pathname exactly as the dispatcher signed it.
    const path = new URL(req.url, 'http://x').pathname;
    const ts = req.headers['x-timestamp'] ?? '';
    const nonce = req.headers['x-nonce'] ?? '';
    const sig = String(req.headers['x-signature'] ?? '');
    if (!SECRET) { res.writeHead(503, { 'content-type': 'application/json' }).end('{"error":{"code":"no_secret"}}'); return; }
    const expected = sign(req.method, path, ts, nonce, raw);
    const ok = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    console.log(`[mock-yeldnin] ${req.method} ${path} sig=${ok ? 'OK' : 'BAD'} idem=${req.headers['idempotency-key'] ?? '-'} body=${raw.slice(0, 140)}`);
    if (!ok) { res.writeHead(401, { 'content-type': 'application/json' }).end('{"error":{"code":"bad_signature"}}'); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, received: path }));
  });
}).listen(PORT, () => console.log(`[mock-yeldnin] listening on :${PORT} (secret ${SECRET ? 'set' : 'MISSING — set INTEGRATION_CLIENT_VEEEY_SECRET'})`));
