'use client';

/** Submit button that asks for confirmation first (for server-action forms
 *  rendered by server components — e.g. guarded row Delete/Archive). */
export function ConfirmButton({ warn, className, children }: { warn: string; className?: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={(e) => { if (!confirm(warn)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
