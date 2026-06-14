import sharp from 'sharp';

/**
 * Normalize an uploaded image to WebP (FR-CAT-06). Auto-rotates per EXIF and
 * caps width so huge originals don't bloat the CDN. Returns a WebP buffer.
 */
export async function toWebp(input: Buffer, maxWidth = 1600): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}
