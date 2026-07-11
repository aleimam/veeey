'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-guards';
import { NAV_ITEMS } from '@/lib/admin-nav';

/** Count an admin section visit for the signed-in staffer (dashboard quick
 *  cards). Fire-and-forget from the shell — must never break navigation. */
export async function recordAdminVisitAction(href: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) return;
    if (!NAV_ITEMS.some((i) => i.href === href)) return; // only known sidebar sections
    await prisma.adminSectionUsage.upsert({
      where: { userId_section: { userId: user.id, section: href } },
      update: { count: { increment: 1 } },
      create: { userId: user.id, section: href, count: 1 },
    });
  } catch {
    // best-effort telemetry only
  }
}
