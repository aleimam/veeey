import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'text';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Compose the `.v-btn` class list — handy for styling a Next `<Link>` as a button. */
export function btnClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  block = false,
  className = '',
): string {
  return [
    'v-btn',
    `v-btn--${variant}`,
    size !== 'md' ? `v-btn--${size}` : '',
    block ? 'v-btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

/**
 * Veeey Design System pill button.
 * Variants: primary (emerald CTA), secondary (green outline), dark (solid
 * green, for headers/footers), text (inline link-style). Renders inside the
 * `.veeey-shop` scope where the `.v-btn` styles resolve.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  iconLeft,
  iconRight,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button className={btnClass(variant, size, block, className)} type={type} {...rest}>
      {iconLeft && (
        <span className="v-btn__icon" aria-hidden="true">
          {iconLeft}
        </span>
      )}
      {children}
      {iconRight && (
        <span className="v-btn__icon" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}
