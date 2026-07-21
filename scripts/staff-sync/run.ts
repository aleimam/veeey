import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { integrationSecret, yeldninBaseUrl, VEEEY_CLIENT_ID } from '@/lib/integration/config';
import { signRequest } from '@/lib/integration/hmac-logic';
import { syncStaff } from '@/lib/staff-sync';

/**
 * Mirror YeldnIN's staff roster into this store's departments.
 *
 *   npx tsx scripts/staff-sync/run.ts            # DRY RUN — prints the plan
 *   npx tsx scripts/staff-sync/run.ts --commit
 *
 * Runs identically on both boxes: YELDNIN_BASE_URL is 127.0.0.1:3200 on each —
 * YeldnIN itself on the veeey.com box, the SSH tunnel to it on veeey.net.
 *
 * Auto-revoking is the point (a leaver must lose admin), so the default is a dry
 * run and every add/remove is printed before anything is written.
 */
async function fetchRoster(): Promise<unknown[]> {
  const secret = integrationSecret();
  if (!secret) throw new Error('INTEGRATION_CLIENT_VEEEY_SECRET is not set — cannot sign the request');
  const path = '/staff';
  const canonicalPath = `/api/integration/v1${path}`;
  const ts = String(Date.now());
  const nonce = randomUUID();
  const sig = signRequest(secret, 'GET', canonicalPath, ts, nonce, '');
  const res = await fetch(`${yeldninBaseUrl()}${path}`, {
    headers: { 'X-Client-Id': VEEEY_CLIENT_ID, 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Signature': sig },
    redirect: 'manual', // a redirect would hand back an HTML page as "the roster"
  });
  if (!res.ok) throw new Error(`YeldnIN /staff returned ${res.status}`);
  const body = (await res.json()) as { staff?: unknown[] };
  if (!Array.isArray(body.staff)) throw new Error('unexpected payload — no staff array');
  return body.staff;
}

async function main() {
  const commit = process.argv.includes('--commit');
  console.log(`\n=== staff sync from YeldnIN — ${commit ? 'COMMIT' : 'DRY RUN (no writes)'} ===`);
  try {
    const roster = await fetchRoster();
    console.log(`  roster received: ${roster.length} user(s)`);
    const r = await syncStaff(roster, { commit });
    console.log(`  in scope: ${r.total} · excluded (xoonx-only): ${r.excluded} · new accounts: ${r.created}`);

    if (!r.changes.length) console.log('\n  Nothing to change — already in sync.');
    for (const c of r.changes) {
      const bits = [
        c.created ? 'CREATE (no password)' : null,
        c.add.length ? `+${c.add.join(',+')}` : null,
        c.remove.length ? `-${c.remove.join(',-')}` : null,
        c.skipped ?? null,
      ].filter(Boolean);
      console.log(`   ${c.email.padEnd(26)} ${bits.join('  ')}`);
    }
    for (const w of r.warnings) console.log(`   ⚠️ ${w}`);
    if (r.created && commit) console.log('\n  New accounts have NO password — set them in /admin/staff-users.');
    console.log(commit ? '\n✅ applied.\n' : '\nℹ️ DRY RUN — nothing written. Re-run with --commit.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
