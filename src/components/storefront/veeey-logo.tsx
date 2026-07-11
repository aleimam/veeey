import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Veeey brand lockup (pill + leaf icon + "veeey" wordmark). The source artwork
 * is transparent — never on a white box. `light` uses the white knockout for
 * green / dark backgrounds. Intrinsic art is 2172×724 (~3:1).
 * `src` overrides with an admin-uploaded logo (branding settings); its aspect
 * ratio is unknown, so display sizing relies on fixed height + auto width.
 */
export function VeeeyLogo({
  className,
  variant = 'default',
  size = 30,
  priority = false,
  src: srcOverride,
  alt = 'Veeey — You Deserve More',
}: {
  className?: string;
  variant?: 'default' | 'light';
  size?: number;
  priority?: boolean;
  src?: string;
  alt?: string;
}) {
  const src = srcOverride || (variant === 'light' ? '/brand/veeey-logo-white.png' : '/brand/veeey-logo-mark.png');
  const width = Math.round((size * 2172) / 724);
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={size}
      priority={priority}
      unoptimized={!!srcOverride}
      sizes={`${width}px`}
      className={cn('block w-auto', className)}
      style={{ height: size, width: 'auto' }}
    />
  );
}
