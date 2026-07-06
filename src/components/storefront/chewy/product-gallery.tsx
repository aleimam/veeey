'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { pick } from '@/lib/admin-i18n';
import { Icon } from '@/components/storefront/ui/icon';

export type GalleryImage = { id: string; url: string; alt?: string | null };

/**
 * PDP image gallery (audit P1 5.4): clickable thumbnails, swipeable main
 * image, and a full-screen lightbox with zoom + keyboard navigation. Images
 * go through next/image, which already serves WebP/AVIF variants.
 */
export function ProductGallery({ images, name, locale = 'en' }: { images: GalleryImage[]; name: string; locale?: string }) {
  const t = pick(locale);
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;

  const step = useCallback(
    (delta: number) => {
      setZoomed(false);
      setCurrent((c) => (c + delta + images.length) % images.length);
    },
    [images.length],
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightbox(false); setZoomed(false); }
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox, step]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || !many) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const img = images[current] ?? images[0];
  const navBtn = 'absolute top-1/2 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-card)] transition-opacity hover:bg-white';

  return (
    <div>
      <div
        className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-[20px] border border-[color:var(--green-dark-05)]"
        style={{ background: 'linear-gradient(160deg,#fff,var(--surface) 70%)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          type="button"
          className="absolute inset-0 z-[5] cursor-zoom-in"
          aria-label={t('Open image zoom', 'تكبير الصورة')}
          onClick={() => setLightbox(true)}
        />
        <Image key={img.id} src={img.url} alt={img.alt || name} fill sizes="(max-width:1024px) 100vw, 45vw" className="object-contain p-[8%]" priority={current === 0} />
        {many && (
          <>
            <button type="button" aria-label={t('Previous image', 'الصورة السابقة')} onClick={(e) => { e.stopPropagation(); step(-1); }} className={`${navBtn} start-3 opacity-0 group-hover:opacity-100`}>
              <Icon name="chevron-left" size={18} color="var(--green-dark)" className="rtl:rotate-180" />
            </button>
            <button type="button" aria-label={t('Next image', 'الصورة التالية')} onClick={(e) => { e.stopPropagation(); step(1); }} className={`${navBtn} end-3 opacity-0 group-hover:opacity-100`}>
              <Icon name="chevron-right" size={18} color="var(--green-dark)" className="rtl:rotate-180" />
            </button>
            <span className="absolute bottom-3 end-3 z-[6] rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate">
              {current + 1} / {images.length}
            </span>
          </>
        )}
        <span className="absolute bottom-3 start-3 z-[4] flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate opacity-0 transition-opacity group-hover:opacity-100">
          <Icon name="zoom-in" size={13} color="var(--slate)" /> {t('Click to zoom', 'اضغط للتكبير')}
        </span>
      </div>

      {many && (
        <div className="mt-3.5 flex gap-3 overflow-x-auto pb-1">
          {images.map((im, n) => (
            <button
              key={im.id}
              type="button"
              aria-label={t(`Image ${n + 1}`, `صورة ${n + 1}`)}
              aria-current={n === current}
              onClick={() => { setZoomed(false); setCurrent(n); }}
              className={`relative size-[72px] shrink-0 overflow-hidden rounded-[12px] bg-white ${n === current ? 'border-2 border-green-dark' : 'border border-[color:var(--slate-border)] hover:border-green-mid'}`}
            >
              <Image src={im.url} alt="" fill sizes="72px" className="object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={name}
          onClick={() => { setLightbox(false); setZoomed(false); }}
        >
          <button
            type="button"
            aria-label={t('Close', 'إغلاق')}
            onClick={() => { setLightbox(false); setZoomed(false); }}
            className="absolute end-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/90 hover:bg-white"
          >
            <Icon name="x" size={20} color="var(--ink)" />
          </button>
          {many && (
            <>
              <button type="button" aria-label={t('Previous image', 'الصورة السابقة')} onClick={(e) => { e.stopPropagation(); step(-1); }} className={`${navBtn} start-4`}>
                <Icon name="chevron-left" size={20} color="var(--green-dark)" className="rtl:rotate-180" />
              </button>
              <button type="button" aria-label={t('Next image', 'الصورة التالية')} onClick={(e) => { e.stopPropagation(); step(1); }} className={`${navBtn} end-4`}>
                <Icon name="chevron-right" size={20} color="var(--green-dark)" className="rtl:rotate-180" />
              </button>
            </>
          )}
          <div
            className={`relative h-[85vh] w-full max-w-4xl ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <Image
              src={img.url}
              alt={img.alt || name}
              fill
              sizes="100vw"
              className={`object-contain transition-transform duration-200 ${zoomed ? 'scale-[1.8]' : ''}`}
            />
          </div>
          {many && (
            <span className="absolute bottom-5 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate">
              {current + 1} / {images.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
