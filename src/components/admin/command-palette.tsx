'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { Search } from 'lucide-react';

export type Cmd = { href: string; label: string; section: string };

/** ⌘K / Ctrl+K command palette over the admin nav. Also opens on a
 *  `veeey:cmdk` window event (dispatched by the top-bar search button). */
export function CommandPalette({ items, locale }: { items: Cmd[]; locale: string }) {
  const t = pick(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
        setQ('');
        setActive(0);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('veeey:cmdk', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('veeey:cmdk', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setQ('');
    setActive(0);
  };
  const query = q.trim().toLowerCase();
  const filtered = query ? items.filter((i) => i.label.toLowerCase().includes(query) || i.section.toLowerCase().includes(query)) : items;
  const go = (href: string) => {
    close();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label={t('Command menu', 'قائمة الأوامر')}>
      <div className="absolute inset-0 bg-foreground/40" onClick={close} aria-hidden="true" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={18} className="text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const sel = filtered[active];
                if (sel) go(sel.href);
              }
            }}
            placeholder={t('Search pages and actions…', 'ابحث في الصفحات والإجراءات…')}
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            aria-label={t('Search', 'بحث')}
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('No results', 'لا توجد نتائج')}</li>}
          {filtered.map((i, idx) => (
            <li key={i.href}>
              <button
                type="button"
                onMouseMove={() => setActive(idx)}
                onClick={() => go(i.href)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start text-sm transition-colors ${
                  idx === active ? 'bg-accent text-accent-foreground' : 'text-foreground'
                }`}
              >
                <span>{i.label}</span>
                <span className="text-xs text-muted-foreground">{i.section}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
