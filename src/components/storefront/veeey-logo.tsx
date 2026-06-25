import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Veeey brand lockup (pill + leaf icon + "veeey" wordmark). The source artwork
 * is transparent — never on a white box. `light` uses the white knockout for
 * green / dark backgrounds. Intrinsic art is 2172×724 (~3:1).
 */
export function VeeeyLogo({
  className,
  variant = 'default',
  size = 30,
  priority = false,
}: {
  className?: string;
  variant?: 'default' | 'light';
  size?: number;
  priority?: boolean;
}) {
  const src = variant === 'light' ? '/brand/veeey-logo-white.png' : '/brand/veeey-logo-mark.png';
  const width = Math.round((size * 2172) / 724);
  return (
    <Image
      src={src}
      alt="Veeey — You Deserve More"
      width={width}
      height={size}
      priority={priority}
      sizes={`${width}px`}
      className={cn('block w-auto', className)}
      style={{ height: size, width: 'auto' }}
    />
  );
}
