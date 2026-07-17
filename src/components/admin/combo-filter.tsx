'use client';

import { useId, useMemo, useRef, useState } from 'react';

export type ComboOption = { value: string; label: string };

const MAX_VISIBLE = 50;

/**
 * Searchable single-select for filter bars (V7 audit C2). The products list's
 * brand filter was a native <select> with ~650 options — unscannable, and on
 * touch a full-screen wheel. This types-to-filter instead: a text input with a
 * listbox of matches; the chosen id travels in a hidden input so the GET form
 * submits exactly what the old select did.
 *
 * Keyboard: ↓/↑ move, Enter picks, Esc closes, clearing the text clears the
 * selection. Combobox ARIA throughout.
 */
export function ComboFilter({
  name,
  options,
  value,
  placeholder,
  allLabel,
}: {
  name: string;
  options: ComboOption[];
  value?: string;
  placeholder?: string;
  allLabel: string;
}) {
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState(selected?.label ?? '');
  const [picked, setPicked] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const blurTimer = useRef<number | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    // With no query (or the query still equal to the pick), show the top of the
    // full list rather than nothing — the user may just want to browse.
    const pool = !q || q === selected?.label.toLowerCase() ? options : options.filter((o) => o.label.toLowerCase().includes(q));
    return pool.slice(0, MAX_VISIBLE);
  }, [query, options, selected]);

  const pick = (o: ComboOption | null) => {
    setPicked(o?.value ?? '');
    setQuery(o?.label ?? '');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); pick(matches[active] ?? null); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="relative">
      <input type="hidden" name={name} value={picked} />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        value={query}
        placeholder={placeholder ?? allLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
          if (e.target.value.trim() === '') setPicked(''); // cleared text = no filter
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on an option lands before the list unmounts.
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={onKeyDown}
        className="h-9 min-w-44 rounded-md border border-border bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full min-w-44 overflow-auto rounded-md border border-border bg-card py-1 shadow-md"
        >
          <li
            role="option"
            aria-selected={picked === ''}
            onMouseDown={(e) => { e.preventDefault(); pick(null); }}
            className="cursor-pointer px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-surface"
          >
            {allLabel}
          </li>
          {matches.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === picked}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              className={`cursor-pointer px-2.5 py-1.5 text-sm hover:bg-surface ${i === active ? 'bg-surface' : ''} ${o.value === picked ? 'font-medium text-primary' : ''}`}
            >
              {o.label}
            </li>
          ))}
          {matches.length === 0 && <li className="px-2.5 py-1.5 text-sm text-muted-foreground">—</li>}
        </ul>
      )}
    </div>
  );
}
