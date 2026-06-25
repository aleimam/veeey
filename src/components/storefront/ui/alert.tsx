import type { ReactNode } from 'react';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const ICONS: Record<AlertVariant, ReactNode> = {
  success: <path d="M20 6 9 17l-5-5" />,
  error: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
};

/**
 * Veeey Alert — inline status message with a leading icon. `onClose` (optional)
 * renders a dismiss button; pass it only from a client component.
 */
export function Alert({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
}: {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
}) {
  return (
    <div className={['v-alert', `v-alert--${variant}`, className].filter(Boolean).join(' ')} role="status">
      <span className="v-alert__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[variant]}
        </svg>
      </span>
      <div className="v-alert__body">
        {title && <p className="v-alert__title">{title}</p>}
        {children && <p className="v-alert__msg">{children}</p>}
      </div>
      {onClose && (
        <button className="v-alert__close" aria-label="Dismiss" onClick={onClose} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
