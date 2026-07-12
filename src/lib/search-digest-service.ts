import { prisma } from '@/lib/prisma';
import { getSetting } from '@/lib/settings-service';
import { dispatchEmail } from '@/lib/notification-dispatch';
import { searchOverview, unstockedDemand } from '@/lib/search-analytics';
import { renderSearchDigest } from '@/lib/search-digest';

/**
 * Weekly search digest (search extra #6). The worker runs this Mondays; it emails
 * staff last week's search headline metrics, top + zero-result terms, purchase-
 * driving terms, and clicked-but-out-of-stock products. Gated by the admin Setting
 * `search.weeklyDigest`; recipients from `search.digestRecipients` or all staff.
 * The pure rendering lives in search-digest.ts (unit-tested).
 */
export async function sendWeeklySearchDigest(): Promise<{ sent: number; skipped?: string }> {
  if ((await getSetting('search.weeklyDigest')).trim().toLowerCase() !== 'on') return { sent: 0, skipped: 'disabled' };

  const configured = (await getSetting('search.digestRecipients'))
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
  const recipients = configured.length
    ? configured
    : (await prisma.user.findMany({ where: { AND: [{ email: { not: null } }, { OR: [{ departments: { some: {} } }, { roleId: { not: null } }] }] }, select: { email: true } }))
        .map((u) => u.email!)
        .filter(Boolean);
  if (!recipients.length) return { sent: 0, skipped: 'no recipients' };

  const [overview, demand] = await Promise.all([searchOverview(7), unstockedDemand(7)]);
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86_400_000);
  const { subject, body } = renderSearchDigest({
    from,
    to,
    totalSearches: overview.totalSearches,
    ctr: overview.ctr,
    zeroRate: overview.zeroRate,
    soldClicks: overview.funnel.soldClicks,
    topTerms: overview.topTerms.map((t) => ({ term: t.term, searches: t.searches })),
    zeroTerms: overview.zeroTerms.map((t) => ({ term: t.term, searches: t.searches })),
    drivingTerms: overview.drivingTerms.map((t) => ({ term: t.term, soldClicks: t.soldClicks })),
    outOfStock: demand.outOfStock.map((p) => ({ name: p.nameEn, clicks: p.clicks })),
  });

  let sent = 0;
  for (const addr of recipients) {
    const r = await dispatchEmail(addr, subject, body);
    if (r.ok) sent += 1;
  }
  return { sent };
}
