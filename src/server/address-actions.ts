'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { createAddress, updateAddress, deleteAddress, setDefaultAddress } from '@/lib/address-service';
import { checkPhoneValue } from '@/lib/phone';

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

async function currentCustomerId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.customerId ?? null;
}

export async function saveAddressAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const cid = await currentCustomerId();
  if (!cid) redirect(`/${locale}/login`);
  // Re-validate what <PhoneInput> submitted — the control is a convenience, the
  // server is the gate (owner 2026-07-22 #226).
  const phone = str(fd, 'phone');
  if (phone && checkPhoneValue(phone)) redirect(`/${locale}/account/addresses?error=phone`);
  const input = {
    governorate: str(fd, 'governorate') ?? '',
    city: str(fd, 'city') ?? '',
    area: str(fd, 'area') ?? '',
    street: str(fd, 'street'),
    building: str(fd, 'building'),
    phone,
    isDefaultShipping: fd.get('isDefaultShipping') != null,
  };
  const id = str(fd, 'id');
  try {
    if (id) await updateAddress(cid, id, input);
    else await createAddress(cid, input);
  } catch {
    redirect(`/${locale}/account/addresses?error=1`);
  }
  revalidatePath(`/${locale}/account/addresses`);
  redirect(`/${locale}/account/addresses?saved=1`);
}

export async function deleteAddressAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const cid = await currentCustomerId();
  if (!cid) redirect(`/${locale}/login`);
  const id = str(fd, 'id');
  if (id) await deleteAddress(cid, id);
  revalidatePath(`/${locale}/account/addresses`);
  redirect(`/${locale}/account/addresses`);
}

export async function setDefaultAddressAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const cid = await currentCustomerId();
  if (!cid) redirect(`/${locale}/login`);
  const id = str(fd, 'id');
  if (id) await setDefaultAddress(cid, id);
  revalidatePath(`/${locale}/account/addresses`);
  redirect(`/${locale}/account/addresses`);
}
