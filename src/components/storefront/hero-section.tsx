import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { btnClass } from '@/components/storefront/ui/button'

type HeroContent = { heroTitle?: string; heroSubtitle?: string }

/**
 * Storefront v2 split hero: a green-gradient brand panel (eyebrow, headline,
 * subtitle, two CTAs, watermark icon) beside a lifestyle image. Headline +
 * subtitle remain admin-editable via home content.
 */
export function HeroSection({ content }: { content?: HeroContent }) {
  const t = useTranslations('storefront.hero')
  return (
    <section className="mx-auto max-w-[1280px] px-4 pb-2 pt-8 sm:px-6 lg:px-8 lg:pt-10">
      <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex min-h-[360px] flex-col justify-center overflow-hidden rounded-[20px] bg-gradient-to-br from-green-dark to-green-emerald p-10 text-white sm:p-12">
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -end-12 opacity-[0.12]">
            <Image src="/brand/veeey-icon.png" alt="" width={300} height={300} />
          </div>
          <div className="relative">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-lime">Health Inside</span>
            <h1 className="mt-4 max-w-[460px] text-4xl font-bold leading-[1.08] sm:text-5xl">
              {content?.heroTitle || t('title')}
            </h1>
            <p className="mt-4 max-w-[420px] text-base leading-relaxed text-white/85">
              {content?.heroSubtitle || t('subtitle')}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className={btnClass('primary')}>
                {t('shop')}
              </Link>
              <Link
                href="/p/how-to-order"
                className="v-btn v-btn--dark"
                style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)' }}
              >
                {t('learnMore')}
              </Link>
            </div>
          </div>
        </div>

        <Link
          href="/products"
          className="group relative block min-h-[360px] overflow-hidden rounded-[20px] border border-[color:var(--green-dark-05)]"
        >
          <Image
            src="/lifestyle/kitchen-wellness.jpg"
            alt={t('cards.bestsellersAlt')}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(28,37,48,0.78)] to-transparent p-7">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-lime">Health Inside</span>
          </div>
        </Link>
      </div>
    </section>
  )
}
