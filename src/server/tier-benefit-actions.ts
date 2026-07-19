'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ensureBenefits, toggleTierBenefit, createManualBenefit, deleteManualBenefit } from '@/lib/tier-benefit-service';

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

function back(locale: string, qs = ''): never {
  revalidatePath(`/${locale}/admin/tier-benefits`);
  redirect(`/${locale}/admin/tier-benefits${qs ? `?${qs}` : ''}`);
}

export async function toggleTierBenefitAction(fd: FormData): Promise<void> {
  const locale = str(fd, 'locale') ?? 'en';
  try {
    await toggleTierBenefit(str(fd, 'benefitId') ?? '', str(fd, 'tierId') ?? '', fd.get('granted') === 'on');
  } catch {
    back(locale, 'error=1');
  }
  back(locale, 'saved=1');
}

export async function createManualBenefitAction(fd: FormData): Promise<void> {
  const locale = str(fd, 'locale') ?? 'en';
  try {
    await ensureBenefits();
    await createManualBenefit({ nameEn: str(fd, 'nameEn') ?? '', nameAr: str(fd, 'nameAr') ?? '' });
  } catch {
    back(locale, 'error=1');
  }
  back(locale, 'saved=1');
}

export async function deleteManualBenefitAction(fd: FormData): Promise<void> {
  const locale = str(fd, 'locale') ?? 'en';
  try {
    await deleteManualBenefit(str(fd, 'id') ?? '');
  } catch {
    back(locale, 'error=1');
  }
  back(locale, 'saved=1');
}
