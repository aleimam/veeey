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

/** Favicon: square 64px PNG (universal browser support, unlike WebP/ICO),
 *  padded with transparency when the source isn't square. */
export async function toFaviconPng(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}
