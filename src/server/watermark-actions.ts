'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth-guards';
import { enqueue, QUEUES } from '@/lib/jobs';
import { saveWatermarkSettings, runWatermark, type RunParams, type WatermarkScope } from '@/lib/watermark-service';

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v : ''; };
const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const base = (locale: string) => `/${locale}/admin/watermark`;

export async function saveWatermarkSettingsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await saveWatermarkSettings({
    logo: str(fd, 'logo'),
    position: str(fd, 'position'),
    sizePct: str(fd, 'sizePct'),
    opacity: str(fd, 'opacity'),
    marginPct: str(fd, 'marginPct'),
    autoStamp: fd.get('autoStamp') != null ? 'true' : 'false',
  });
  revalidatePath(base(locale));
  redirect(`${base(locale)}?saved=1`);
}

export async function runWatermarkAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  await requirePermission('catalog.write');
  const scope = (['all', 'category', 'brand', 'collection'] as const).find((s) => s === str(fd, 'scope')) ?? 'all';
  const params: RunParams = {
    action: str(fd, 'action') === 'remove' ? 'remove' : 'stamp',
    scope: scope as WatermarkScope,
    scopeId: str(fd, 'scopeId') || undefined,
    primaryOnly: fd.get('primaryOnly') != null,
    onlyUnstamped: fd.get('onlyUnstamped') != null,
  };
  // Background job (worker); inline fallback if no boss (dev).
  await enqueue(QUEUES.watermark, params, async () => { await runWatermark(params); });
  revalidatePath(base(locale));
  redirect(`${base(locale)}?started=${params.action}`);
}
