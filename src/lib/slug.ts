import { slugify } from '@/lib/sku';

export { slugify };

/**
 * Produce a slug unique under `exists` by appending -2, -3, … on collision.
 * `exists` returns true when a slug is already taken.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || 'item';
  let candidate = root;
  let n = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${n++}`;
  }
  return candidate;
}
