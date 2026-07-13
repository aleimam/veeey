'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth-guards';
import { isFeatureEnabled } from '@/lib/feature-service';
import { createRefillPlan, updatePlan, adminSetPlanStatus, type PlanOp } from '@/lib/refill-service';

const str = (fd: FormData, k: string) => { const v = fd.get(k); return typeof v === 'string' ? v.trim() : ''; };
const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');

/** PDP "Start Refill plan" — signed-in customers only; first delivery places now. */
export async function startRefillPlanAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const slug = str(fd, 'slug');
  const back = `/${locale}/products/${slug}`;
  if (!(await isFeatureEnabled('refill'))) redirect(back);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);
  const res = await createRefillPlan({
    customerId: user.customerId,
    productId: str(fd, 'productId'),
    qty: Number(str(fd, 'qty')) || 1,
    frequencyDays: Number(str(fd, 'frequency')) || 30,
  });
  if ('error' in res) {
    if (res.error === 'NO_ADDRESS') redirect(`/${locale}/account/addresses?refill=address`);
    redirect(`${back}?refill=${res.error === 'OOS' ? 'oos' : 'failed'}`);
  }
  revalidatePath(`/${locale}/account`);
  redirect(`/${locale}/account?refill=started`);
}

/** Account-page plan ops (pause/resume/cancel/skip/unskip/frequency). */
export async function refillPlanOpAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const user = await getCurrentUser();
  if (!user?.customerId) redirect(`/${locale}/login`);
  const op = str(fd, 'op') as PlanOp;
  const ok = await updatePlan({ customerId: user.customerId }, str(fd, 'planId'), op, Number(str(fd, 'frequency')) || undefined);
  revalidatePath(`/${locale}/account`);
  redirect(`/${locale}/account?refill=${ok ? 'updated' : 'failed'}`);
}

/** SMS manage-link ops — the token IS the capability (no login). */
export async function refillTokenOpAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const token = str(fd, 'token');
  const op = str(fd, 'op') as PlanOp;
  const ok = await updatePlan({ token }, null, op, Number(str(fd, 'frequency')) || undefined);
  redirect(`/${locale}/refill/manage/${token}?r=${ok ? 'ok' : 'failed'}`);
}

/** Admin pause/resume/cancel from /admin/refill. */
export async function adminRefillStatusAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let flag = 'saved=1';
  try {
    const status = str(fd, 'status');
    if (status !== 'ACTIVE' && status !== 'PAUSED' && status !== 'CANCELLED') throw new Error('INVALID');
    await adminSetPlanStatus(str(fd, 'planId'), status);
  } catch (e) {
    flag = e instanceof Error && e.message === 'FORBIDDEN' ? 'error=forbidden' : 'error=1';
  }
  revalidatePath(`/${locale}/admin/refill`);
  redirect(`/${locale}/admin/refill?${flag}`);
}
