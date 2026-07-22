/**
 * The stable key for a delivery district: `<governorate>:<name>`, ASCII-slugged.
 *
 * Pure and in its own module because `city-service.ts` pulls in auth-guards →
 * next-auth, which cannot load under vitest — and this is the part worth testing.
 */
export function cityCode(governorate: string, nameEn: string): string {
  const slug = (s: string) =>
    s.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug(governorate)}:${slug(nameEn)}`;
}
