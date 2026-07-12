'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveTrustpilotConfig } from '@/lib/trustpilot-service';
import type { TpPlacement, TpPlacementCfg } from '@/lib/trustpilot-config';

const s = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const placement = (fd: FormData, p: TpPlacement): TpPlacementCfg => ({
  enabled: fd.get(`${p}.enabled`) === 'on',
  template: s(fd, `${p}.template`),
  height: Number(s(fd, `${p}.height`)) || 0,
});

export async function saveTrustpilotAction(fd: FormData): Promise<void> {
  const locale = fd.get('locale') === 'ar' ? 'ar' : 'en';
  let flag = 'saved=1';
  try {
    await saveTrustpilotConfig({
      businessUnitId: s(fd, 'businessUnitId'),
      domain: s(fd, 'domain'),
      locale: s(fd, 'tpLocale') || 'en-US',
      theme: fd.get('theme') === 'dark' ? 'dark' : 'light',
      home: placement(fd, 'home'),
      footer: placement(fd, 'footer'),
      checkout: placement(fd, 'checkout'),
    });
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=1';
  }
  revalidatePath(`/${locale}/admin/trustpilot`);
  redirect(`/${locale}/admin/trustpilot?${flag}`);
}
