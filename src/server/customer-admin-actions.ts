'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  searchCustomers, quickCreateCustomer, updateCustomerDetails,
  saveCustomerAddress, deleteCustomerAddress, type CustomerHit,
} from '@/lib/customer-admin-service';

/** Staff customer management actions (backend orders revamp, Phase A). The two
 *  JSON-returning functions are called from client components (order form). */

const localeOf = (fd: FormData) => (fd.get('locale') === 'ar' ? 'ar' : 'en');
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};
const bool = (fd: FormData, k: string) => fd.get(k) != null;

// ---- Client-callable (order form) ------------------------------------------
export async function searchCustomersAction(q: string): Promise<CustomerHit[]> {
  try { return await searchCustomers(q); } catch { return []; }
}

export async function quickCreateCustomerAction(input: { name: string; phone: string; email?: string }): Promise<CustomerHit | { error: string }> {
  try {
    return await quickCreateCustomer(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid';
    return { error: msg === 'EMAIL_TAKEN' ? 'email_taken' : msg === 'FORBIDDEN' ? 'forbidden' : 'invalid' };
  }
}

// ---- Profile page forms -----------------------------------------------------
function back(locale: string, id: string, flag: string): never {
  revalidatePath(`/${locale}/admin/customers/${id}`);
  redirect(`/${locale}/admin/customers/${id}?${flag}`);
}

export async function saveCustomerDetailsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? '';
  try {
    await updateCustomerDetails(id, {
      firstName: str(fd, 'firstName') ?? null,
      lastName: str(fd, 'lastName') ?? null,
      email: str(fd, 'email') ?? '',
      phone: str(fd, 'phone') ?? '',
      tierId: str(fd, 'tierId') ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message === 'EMAIL_TAKEN' ? 'error=email_taken' : 'error=1';
    back(locale, id, msg);
  }
  back(locale, id, 'saved=1');
}

export async function saveCustomerAddressAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const customerId = str(fd, 'customerId') ?? '';
  try {
    await saveCustomerAddress(customerId, str(fd, 'addressId') ?? null, {
      governorate: str(fd, 'governorate') ?? '',
      city: str(fd, 'city') ?? '',
      area: str(fd, 'area') ?? '',
      street: str(fd, 'street'),
      building: str(fd, 'building'),
      phone: str(fd, 'phone'),
      isDefaultShipping: bool(fd, 'isDefaultShipping'),
    });
  } catch {
    back(locale, customerId, 'error=1');
  }
  back(locale, customerId, 'saved=1');
}

export async function deleteCustomerAddressAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const customerId = str(fd, 'customerId') ?? '';
  const addressId = str(fd, 'addressId') ?? '';
  try {
    await deleteCustomerAddress(customerId, addressId);
  } catch (e) {
    back(locale, customerId, e instanceof Error && e.message === 'IN_USE' ? 'error=address_in_use' : 'error=1');
  }
  back(locale, customerId, 'saved=1');
}
