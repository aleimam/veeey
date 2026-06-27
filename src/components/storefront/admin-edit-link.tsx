import { getCurrentUser } from '@/lib/auth-guards';
import { canAccessAdmin } from '@/lib/rbac';
import { Link } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';

/**
 * Storefront → admin deep link, rendered only for logged-in admins. Lets staff
 * jump from any public page straight to its edit screen. `href` is locale-relative
 * (e.g. "/admin/products/edit/<id>"). Renders nothing for shoppers.
 */
export async function AdminEditLink({ href, locale }: { href: string; locale: string }) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.permissions)) return null;
  const tb = pick(locale);
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--green-dark-05)] bg-white/95 px-3 py-1 text-xs font-semibold text-green-dark shadow-sm transition-colors hover:bg-green-wash"
    >
      ✎ {tb('Edit in admin', 'تعديل في اللوحة')}
    </Link>
  );
}
