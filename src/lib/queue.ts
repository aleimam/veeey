import { PgBoss } from 'pg-boss';

/**
 * pg-boss (Postgres-backed job queue) — installed and wired, no jobs registered
 * yet (P0). Async work (notifications, wishlist/back-in-stock alerts, feeds) is
 * added from P12 onward. The boss is created lazily and only when DATABASE_URL
 * is present, so importing this module never throws at build time.
 */
let boss: PgBoss | null = null;

export function getBoss(): PgBoss | null {
  if (boss) return boss;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  boss = new PgBoss({ connectionString });
  return boss;
}
