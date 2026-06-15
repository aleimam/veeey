'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { saveTier, deleteTier, addTierRule, deleteTierRule } from '@/lib/tier-service';
import { InUseError } from '@/lib/soft-delete-service';
import type { AdminFormState } from '@/server/admin-actions';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string): string | undefined => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const bool = (fd: FormData, k: string): boolean => fd.get(k) != null;

function fail(e: unknown): AdminFormState {
  if (e instanceof Error && e.message === 'FORBIDDEN') return { error: 'forbidden' };
  console.error('tier action failed', e);
  return { error: 'invalid' };
}

export async function saveTierAction(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const locale = localeOf(fd);
  try {
    await saveTier(str(fd, 'id') ?? null, {
      key: str(fd, 'key') ?? '',
      nameEn: str(fd, 'nameEn') ?? '',
      nameAr: str(fd, 'nameAr') ?? '',
      rank: str(fd, 'rank') ?? '1',
      earnRatePerEgp: str(fd, 'earnRatePerEgp') ?? '1',
      color: str(fd, 'color') ?? null,
      badge: str(fd, 'badge') ?? null,
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/${locale}/admin/tiers`);
  redirect(`/${locale}/admin/tiers`);
}

export async function deleteTierAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id');
  if (id) {
    try {
      await deleteTier(id);
    } catch (e) {
      if (e instanceof InUseError) {
        revalidatePath(`/${locale}/admin/tiers`);
        redirect(`/${locale}/admin/tiers?error=in_use`);
      }
      fail(e);
    }
  }
  revalidatePath(`/${locale}/admin/tiers`);
  redirect(`/${locale}/admin/tiers`);
}

// match field encodes "TYPE:value" (e.g. CATEGORY:ckxyz) so a single select
// can offer categories, tags, and attribute values together.
export async function addTierRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const tierId = str(fd, 'tierId');
  const match = str(fd, 'match') ?? '';
  const sep = match.indexOf(':');
  const matchType = sep > 0 ? match.slice(0, sep) : '';
  const matchValue = sep > 0 ? match.slice(sep + 1) : '';
  const effect = str(fd, 'effect') ?? 'PRICE';
  if (tierId && (matchType === 'CATEGORY' || matchType === 'TAG' || matchType === 'ATTRIBUTE') && matchValue) {
    try {
      await addTierRule(tierId, {
        matchType,
        matchValue,
        effect: effect as 'PRICE' | 'VISIBILITY' | 'AVAILABILITY',
        priceModifierType: (str(fd, 'priceModifierType') ?? 'PERCENT') as 'PERCENT' | 'FIXED',
        priceModifierValue: str(fd, 'priceModifierValue') ?? '0',
        visible: bool(fd, 'visible'),
        available: bool(fd, 'available'),
      });
    } catch (e) {
      fail(e);
    }
  }
  revalidatePath(`/${locale}/admin/tiers/edit/${tierId}`);
  redirect(`/${locale}/admin/tiers/edit/${tierId}`);
}

export async function deleteTierRuleAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'ruleId');
  const tierId = str(fd, 'tierId');
  if (id) {
    try { await deleteTierRule(id); } catch (e) { fail(e); }
  }
  revalidatePath(`/${locale}/admin/tiers/edit/${tierId}`);
  redirect(`/${locale}/admin/tiers/edit/${tierId}`);
}
