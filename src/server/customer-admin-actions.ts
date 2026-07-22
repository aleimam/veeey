'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  searchCustomers, quickCreateCustomer, updateCustomerDetails, updateCustomerStanding,
  scanAndFlagSuspicious, deleteSpamCustomers, saveCustomerAddress, deleteCustomerAddress, type CustomerHit,
} from '@/lib/customer-admin-service';
import { deleteCustomerAnalytics } from '@/lib/analytics/retention-service';
import { requirePermission } from '@/lib/auth-guards';
import { checkPhoneValue } from '@/lib/phone';
import { audit } from '@/lib/audit';

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
  if (checkPhoneValue(input.phone)) return { error: 'invalid' };
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
  // Re-validate the <PhoneInput> value server-side (owner 2026-07-22 #226).
  const phone = str(fd, 'phone');
  if (phone && checkPhoneValue(phone)) back(locale, id, 'error=phone');
  try {
    await updateCustomerDetails(id, {
      firstName: str(fd, 'firstName') ?? null,
      lastName: str(fd, 'lastName') ?? null,
      email: str(fd, 'email') ?? '',
      phone: str(fd, 'phone') ?? '',
      tierId: str(fd, 'tierId') ?? null,
      tierManual: fd.get('tierManual') === 'on',
      tierManualUntil: str(fd, 'tierManualUntil') || null,
    });
  } catch (e) {
    const msg = e instanceof Error && e.message === 'EMAIL_TAKEN' ? 'error=email_taken' : 'error=1';
    back(locale, id, msg);
  }
  back(locale, id, 'saved=1');
}

export async function scanSuspiciousAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  let flagged = 0;
  try {
    flagged = (await scanAndFlagSuspicious()).flagged;
  } catch {
    revalidatePath(`/${locale}/admin/customers`);
    redirect(`/${locale}/admin/customers?error=scan`);
  }
  revalidatePath(`/${locale}/admin/customers`);
  redirect(`/${locale}/admin/customers?flagged=${flagged}${flagged > 0 ? '&status=FLAGGED' : ''}`);
}

/** Delete the fake accounts ticked on the review screen (owner 2026-07-22).
 *  The service re-runs the heuristics and refuses anything that no longer
 *  qualifies, so a stale selection can only ever delete less, never more. */
export async function deleteSpamCustomersAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const ids = fd.getAll('ids').filter((v): v is string => typeof v === 'string');
  let result: { deleted: number; skipped: number };
  try {
    result = await deleteSpamCustomers(ids);
  } catch {
    revalidatePath(`/${locale}/admin/customers/spam`);
    redirect(`/${locale}/admin/customers/spam?error=delete`);
  }
  revalidatePath(`/${locale}/admin/customers/spam`);
  revalidatePath(`/${locale}/admin/customers`);
  redirect(`/${locale}/admin/customers/spam?deleted=${result.deleted}&skipped=${result.skipped}`);
}

export async function saveCustomerStandingAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const id = str(fd, 'id') ?? '';
  try {
    const status = str(fd, 'status');
    await updateCustomerStanding(id, {
      status: status === 'FLAGGED' || status === 'BLOCKED' ? status : 'ACTIVE',
      marketingConsent: bool(fd, 'marketingConsent'),
      marketingSmsConsent: bool(fd, 'marketingSmsConsent'),
      adminNotes: (fd.get('adminNotes') as string | null) ?? '',
    });
  } catch {
    back(locale, id, 'error=1');
  }
  back(locale, id, 'saved=1');
}

export async function saveCustomerAddressAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const customerId = str(fd, 'customerId') ?? '';
  const phone = str(fd, 'phone');
  if (phone && checkPhoneValue(phone)) back(locale, customerId, 'error=phone');
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

/**
 * DSAR / right-to-erasure: wipe a customer's first-party analytics footprint
 * (sessions + events). RBAC-gated + audited. The retention cron handles bulk
 * expiry; this is the per-customer erase for a deletion request.
 */
export async function eraseCustomerAnalyticsAction(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const customerId = str(fd, 'customerId') ?? '';
  const user = await requirePermission('customers.write');
  try {
    const r = await deleteCustomerAnalytics(customerId);
    await audit({ actorType: 'USER', actorId: user.id, action: 'customer.analytics.erase', entityType: 'Customer', entityId: customerId, data: { events: r.events, sessions: r.sessions } });
  } catch {
    back(locale, customerId, 'error=1');
  }
  back(locale, customerId, 'analytics_erased=1');
}
