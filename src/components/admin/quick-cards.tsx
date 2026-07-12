'use client';

import { Link } from '@/i18n/navigation';
import { LayoutGrid } from 'lucide-react';
import { ICONS } from '@/components/admin/admin-shell';

export type QuickCard = { href: string; label: string; icon: string };

/**
 * Dashboard quick-access cards — the signed-in staffer's 8 most-visited admin
 * sections (visit counts recorded by AdminShell), topped up with sensible
 * defaults until enough history exists.
 */
export function QuickCards({ items }: { items: QuickCard[] }) {
  if (items.length === 0) return null;
  // Up to 5 per row on desktop → 3–5 cards fill one row, 6–10 wrap to two.
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((it) => {
        const Icon = ICONS[it.icon] ?? LayoutGrid;
        return (
          <Link
            key={it.href}
            href={it.href}
            className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon size={18} />
            </span>
            <span className="text-xs font-medium leading-tight text-foreground group-hover:text-primary">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
