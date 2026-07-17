/**
 * Is this pathname inside the admin panel? (V6 audit S15)
 *
 * Accepts both URL shapes in play: the raw browser path (`/en/admin/orders`,
 * locale-prefixed) and next-intl's stripped form (`/admin/orders`). The second
 * segment can only be `admin` for admin routes — every storefront route's
 * second segment is a fixed route name (category/product/brand/…), never a
 * slug — so this can't misfire on catalogue content.
 *
 * Kept pure and dependency-free: it's imported by client components on both
 * sides of the NextIntlClientProvider boundary, and it's unit-tested.
 */
export function isAdminPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] === 'admin' || segments[1] === 'admin';
}
