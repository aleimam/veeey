'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/storefront/ui/icon';
import { btnClass } from '@/components/storefront/ui/button';

export type HeroSlide = { eyebrow: string; title: string; body: string; cta: string; href: string; images: string[] };

/** Chewy-pattern auto-rotating hero carousel (white → green-wash, packshots right). */
export function ChewyHero({ slides }: { slides: HeroSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const s = slides[i] ?? slides[0];
  if (!s) return null;
  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-6 sm:px-6">
      <div
        className="relative min-h-[440px] overflow-hidden rounded-[24px] border border-[color:var(--green-dark-05)] shadow-[var(--shadow-sm)]"
        style={{ background: 'linear-gradient(105deg,#fff 30%,var(--green-wash) 82%)' }}
      >
        <div className="grid min-h-[440px] grid-cols-1 md:grid-cols-2">
          <div className="relative z-[2] flex flex-col justify-center p-9 sm:p-12 lg:p-16">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-green-mid">{s.eyebrow}</span>
            <h1 className="mt-3.5 whitespace-pre-line text-4xl font-bold leading-[1.06] text-green-dark sm:text-5xl">{s.title}</h1>
            <p className="mt-4 max-w-[400px] text-base leading-relaxed text-[color:var(--text-muted)]">{s.body}</p>
            <div className="mt-6">
              <Link href={s.href} className={btnClass('primary', 'lg')}>{s.cta}</Link>
            </div>
          </div>
          <div className="relative hidden items-center justify-center overflow-hidden md:flex">
            <div className="absolute size-[78%] rounded-full" style={{ background: 'radial-gradient(circle at 50% 42%, rgba(56,118,77,.12), transparent 70%)' }} />
            <div className="relative flex w-full items-end justify-center gap-[5%] px-[9%]">
              {s.images.slice(0, 2).map((img, n) => (
                <Image
                  key={n}
                  src={img}
                  alt=""
                  width={260}
                  height={320}
                  className="h-auto object-contain drop-shadow-[0_22px_28px_rgba(28,37,48,0.22)]"
                  style={{ width: n === 0 ? '52%' : '44%', transform: n === 1 ? 'translateY(6%)' : 'none' }}
                />
              ))}
            </div>
          </div>
        </div>
        {slides.length > 1 && (
          <div className="absolute bottom-5 start-9 z-[3] flex items-center gap-3.5 sm:start-12 lg:start-16">
            <button
              onClick={() => setPaused(!paused)}
              aria-label={paused ? 'Play' : 'Pause'}
              className="flex size-[30px] items-center justify-center rounded-full border border-[color:var(--slate-border)] bg-white text-green-dark"
            >
              <Icon name={paused ? 'play' : 'pause'} size={14} color="var(--green-dark)" />
            </button>
            <div className="flex gap-2">
              {slides.map((_, n) => (
                <button
                  key={n}
                  onClick={() => setI(n)}
                  aria-label={`Slide ${n + 1}`}
                  className="h-[9px] rounded-full transition-[width]"
                  style={{ width: n === i ? 28 : 9, background: n === i ? 'var(--green-dark)' : 'var(--slate-border)' }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
