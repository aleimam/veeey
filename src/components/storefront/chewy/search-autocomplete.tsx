'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from '@/i18n/navigation';
import { pick } from '@/lib/admin-i18n';
import { formatEGP } from '@/lib/format';
import { Icon } from '@/components/storefront/ui/icon';
import type { SearchSuggestions } from '@/lib/search-service';

/**
 * Header search with live autocomplete (FR-SCH-02; audit P1 5.2). As you type
 * it suggests products (thumbnail, price, in-stock flag), brands, categories
 * and articles; focusing the empty box shows popular searches. Submitting
 * still lands on /search. Debounced, keyboard-navigable, RTL-safe.
 */

const EMPTY: SearchSuggestions = { products: [], brands: [], categories: [], posts: [], popular: [] };

type FlatItem = { href: string; key: string };

export function SearchAutocomplete({ locale, placeholder, className = '' }: { locale: string; placeholder: string; className?: string }) {
  const t = pick(locale);
  const router = useRouter();
  const panelId = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SearchSuggestions>(EMPTY);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seq = useRef(0);

  const load = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const mySeq = ++seq.current;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(value)}&locale=${locale}`);
        const json = (await res.json()) as SearchSuggestions;
        if (mySeq === seq.current) setData(json);
      } catch {
        /* suggestions are best-effort */
      }
    }, 180);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Flat list (in render order) for arrow-key navigation.
  const flat: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    for (const term of data.popular) items.push({ href: `/search?q=${encodeURIComponent(term)}`, key: `pop:${term}` });
    for (const p of data.products) items.push({ href: `/products/${p.slug}`, key: `p:${p.slug}` });
    for (const b of data.brands) items.push({ href: `/products?brand=${b.id}`, key: `b:${b.id}` });
    for (const c of data.categories) items.push({ href: `/products?category=${c.id}`, key: `c:${c.id}` });
    for (const a of data.posts) items.push({ href: `/blog/${a.slug}`, key: `a:${a.slug}` });
    return items;
  }, [data]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  // Log which product was picked from the instant dropdown (search CTR / conversion).
  const beaconProduct = (slug: string, position: number) => {
    const term = q.trim();
    if (!term) return;
    try {
      navigator.sendBeacon?.('/api/search/click', new Blob([JSON.stringify({ term, slug, position, source: 'instant' })], { type: 'application/json' }));
    } catch {
      /* best-effort */
    }
  };

  const hasContent = flat.length > 0;
  let cursor = -1; // running index while rendering rows
  const rowCls = (i: number) =>
    `flex w-full items-center gap-3 px-4 py-2 text-start text-sm ${i === active ? 'bg-green-wash' : 'hover:bg-surface'}`;
  const heading = 'px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-subtle)]';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <form
        action={`/${locale}/search`}
        className="flex h-full w-full items-center overflow-hidden rounded-full bg-white ps-4"
        onSubmit={() => setOpen(false)}
      >
        <input
          name="q"
          type="search"
          autoComplete="off"
          value={q}
          placeholder={placeholder}
          aria-label={t('Search', 'بحث')}
          aria-expanded={open && hasContent}
          aria-controls={panelId}
          role="combobox"
          className="w-full border-none bg-transparent text-sm text-slate outline-none"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(-1);
            setOpen(true);
            load(e.target.value);
          }}
          onFocus={() => {
            setOpen(true);
            load(q);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (!open || flat.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % flat.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a <= 0 ? flat.length - 1 : a - 1));
            } else if (e.key === 'Enter' && active >= 0) {
              e.preventDefault();
              go(flat[active].href);
            }
          }}
        />
        <button type="submit" aria-label={t('Search', 'بحث')} className="flex h-full items-center justify-center bg-lime px-4">
          <Icon name="search" size={20} color="var(--green-dark)" />
        </button>
      </form>

      {open && hasContent && (
        <div id={panelId} className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto rounded-[14px] border border-[color:var(--slate-border)] bg-white pb-2 text-ink shadow-[var(--shadow-lg)]">
          {data.popular.length > 0 && (
            <>
              <div className={heading}>{t('Popular searches', 'عمليات البحث الشائعة')}</div>
              {data.popular.map((term) => {
                cursor++;
                const i = cursor;
                return (
                  <button key={`pop:${term}`} type="button" className={rowCls(i)} onMouseEnter={() => setActive(i)} onClick={() => go(`/search?q=${encodeURIComponent(term)}`)}>
                    <Icon name="trending-up" size={15} color="var(--slate-45)" />
                    <span>{term}</span>
                  </button>
                );
              })}
            </>
          )}

          {data.products.length > 0 && (
            <>
              <div className={heading}>{t('Products', 'المنتجات')}</div>
              {data.products.map((p, pi) => {
                cursor++;
                const i = cursor;
                return (
                  <button key={`p:${p.slug}`} type="button" className={rowCls(i)} onMouseEnter={() => setActive(i)} onClick={() => { beaconProduct(p.slug, pi); go(`/products/${p.slug}`); }}>
                    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-surface">
                      {p.image ? (
                        <Image src={p.image} alt="" fill sizes="40px" className="object-contain p-1" />
                      ) : (
                        <Icon name="package" size={18} color="var(--slate-45)" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      {p.brand && <span className="block truncate text-xs text-[color:var(--text-subtle)]">{p.brand}</span>}
                    </span>
                    <span className="text-end">
                      <span className="block text-sm font-bold text-green-dark">{formatEGP(p.pricePiastres)}</span>
                      {p.inStock ? (
                        <span className="text-[11px] font-semibold text-success">{t('In stock', 'متوفر')}</span>
                      ) : p.preorder ? (
                        <span className="text-[11px] font-semibold text-gold-deep">{t('Pre-order', 'طلب مسبق')}</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[color:var(--text-subtle)]">{t('Out of stock', 'غير متوفر')}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {data.brands.length > 0 && (
            <>
              <div className={heading}>{t('Brands', 'العلامات')}</div>
              {data.brands.map((b) => {
                cursor++;
                const i = cursor;
                return (
                  <button key={`b:${b.id}`} type="button" className={rowCls(i)} onMouseEnter={() => setActive(i)} onClick={() => go(`/products?brand=${b.id}`)}>
                    <Icon name="award" size={15} color="var(--slate-45)" />
                    <span>{b.name}</span>
                  </button>
                );
              })}
            </>
          )}

          {data.categories.length > 0 && (
            <>
              <div className={heading}>{t('Categories', 'الفئات')}</div>
              {data.categories.map((c) => {
                cursor++;
                const i = cursor;
                return (
                  <button key={`c:${c.id}`} type="button" className={rowCls(i)} onMouseEnter={() => setActive(i)} onClick={() => go(`/products?category=${c.id}`)}>
                    <Icon name="folder-tree" size={15} color="var(--slate-45)" />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </>
          )}

          {data.posts.length > 0 && (
            <>
              <div className={heading}>{t('Learn & Blog', 'التعلّم والمدونة')}</div>
              {data.posts.map((a) => {
                cursor++;
                const i = cursor;
                return (
                  <button key={`a:${a.slug}`} type="button" className={rowCls(i)} onMouseEnter={() => setActive(i)} onClick={() => go(`/blog/${a.slug}`)}>
                    <Icon name="book-open" size={15} color="var(--slate-45)" />
                    <span className="truncate">{a.title}</span>
                  </button>
                );
              })}
            </>
          )}

          {q.trim().length >= 2 && (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 border-t border-[color:var(--slate-border)] px-4 py-2.5 text-start text-sm font-semibold text-green-dark hover:bg-surface"
              onClick={() => go(`/search?q=${encodeURIComponent(q.trim())}`)}
            >
              <Icon name="search" size={15} color="var(--green-dark)" />
              {t(`See all results for “${q.trim()}”`, `عرض كل نتائج «${q.trim()}»`)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
