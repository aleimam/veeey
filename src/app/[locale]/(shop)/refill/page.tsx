import type { Metadata } from 'next';
import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { pick } from '@/lib/admin-i18n';
import { prisma } from '@/lib/prisma';
import { toCardProduct, cardProductInclude, visibleProductWhere, type DbCardProduct } from '@/lib/storefront';
import { formatEGP } from '@/lib/format';
import { Icon } from '@/components/storefront/ui/icon';
import { ChewyProductCard } from '@/components/storefront/chewy/chewy-product-card';
import { RefillFrequency } from '@/components/storefront/chewy/refill-frequency';
import { Link } from '@/i18n/navigation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ar' ? 'فيي ريفيل — اشترك ووفّر ١٥٪ — Veeey' : 'Veeey Refill — Subscribe & save 15% — Veeey',
    description:
      locale === 'ar'
        ? 'ضع مكمّلاتك الأساسية على جدول توصيل ووفّر ١٥٪ على كل طلب — أصلية، مؤرّخة، وتصل قبل أن تنفد.'
        : 'Put your essentials on a schedule and save 15% on every delivery — genuine, lot-dated, and delivered before you run out.',
  };
}

async function popularProducts(locale: string, take: number) {
  try {
    const rows = (await prisma.product.findMany({
      where: { status: 'PUBLISHED', AND: [visibleProductWhere] },
      include: cardProductInclude,
      orderBy: [{ ratingCount: 'desc' }, { updatedAt: 'desc' }],
      take,
    })) as unknown as DbCardProduct[];
    return rows.map((p) => toCardProduct(p, locale));
  } catch {
    return [];
  }
}

export default async function RefillPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = pick(locale);

  const products = await popularProducts(locale, 8);
  const plan = products.slice(0, 3).map((p, i) => ({ ...p, every: [30, 60, 30][i] }));
  const refillPrice = (n: number) => Math.round(n * 0.85);
  const planTotal = plan.reduce((s, p) => s + refillPrice(p.pricePiastres), 0);
  const planSaved = Math.round(planTotal * 0.176);

  const steps = [
    { icon: 'package-search', t: ['Pick your products', 'اختر منتجاتك'], s: ['Add any supplement to a Refill plan.', 'أضف أي مكمّل إلى خطة ريفيل.'] },
    { icon: 'calendar-days', t: ['Choose a schedule', 'اختر جدولًا'], s: ['Every 30, 45, 60 or 90 days — your call.', 'كل ٣٠ أو ٤٥ أو ٦٠ أو ٩٠ يومًا — أنت تقرّر.'] },
    { icon: 'truck', t: ['We deliver on time', 'نوصّل في الموعد'], s: ['Genuine, dated stock before you run out.', 'مخزون أصلي ومؤرّخ قبل أن ينفد.'] },
    { icon: 'settings-2', t: ['Adjust anytime', 'عدّل متى شئت'], s: ['Pause, skip, or cancel with one tap.', 'أوقف أو تخطَّ أو ألغِ بنقرة واحدة.'] },
  ] as const;

  const benefits = [
    { icon: 'badge-percent', t: ['Save 15% automatically', 'وفّر ١٥٪ تلقائيًا'], s: ['On every Refill delivery, forever.', 'على كل توصيلة ريفيل، للأبد.'] },
    { icon: 'truck', t: ['Free delivery', 'توصيل مجاني'], s: ['No minimum on Refill orders.', 'بدون حد أدنى على طلبات ريفيل.'] },
    { icon: 'bell', t: ['Smart reminders', 'تذكيرات ذكية'], s: ['We nudge you 3 days before each ship.', 'نذكّرك قبل ٣ أيام من كل شحنة.'] },
    { icon: 'shield-check', t: ['Genuine & dated', 'أصلي ومؤرّخ'], s: ['Pharmacist-checked, lot-dated stock.', 'مخزون مفحوص صيدلانيًا ومؤرّخ.'] },
  ] as const;

  return (
    <div>
      {/* hero */}
      <section style={{ background: 'linear-gradient(140deg,var(--green-dark),var(--green-emerald))' }} className="text-white">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-lime">
              <Icon name="repeat" size={15} color="var(--lime)" /> {t('Veeey Refill', 'فيي ريفيل')}
            </span>
            <h1 className="mt-4 text-[clamp(36px,5vw,56px)] font-bold leading-[1.05]" style={{ fontFamily: 'var(--font-display)' }}>
              {t('Never run out.', 'لا تنفد أبدًا.')}
              <br />
              {t('Save 15% on every delivery.', 'وفّر ١٥٪ على كل توصيلة.')}
            </h1>
            <p className="mt-4 max-w-[480px] text-[16.5px] leading-relaxed text-white/85">
              {t(
                'Put your essentials on a schedule and our pharmacists keep them stocked — genuine, lot-dated and delivered before you run low. Pause, skip or cancel anytime.',
                'ضع مكمّلاتك الأساسية على جدول، ويحرص صيادلتنا على توفّرها — أصلية ومؤرّخة وتصل قبل أن تنقص. أوقف أو تخطَّ أو ألغِ في أي وقت.',
              )}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="v-btn v-btn--primary v-btn--lg">{t('Browse Refill products', 'تصفّح منتجات ريفيل')}</Link>
              <Link href="/account" className="v-btn v-btn--lg border border-white/35 bg-white/15 text-white">{t('Manage my plan', 'إدارة خطتي')}</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-6">
              {[
                ['15%', t('Off every order', 'خصم على كل طلب')],
                [t('Free', 'مجاني'), t('Delivery on Refill', 'توصيل على ريفيل')],
                [t('Any day', 'أي يوم'), t('Pause or skip', 'إيقاف أو تخطٍّ')],
              ].map(([a, b]) => (
                <div key={b}>
                  <div className="text-[28px] font-bold text-lime" style={{ fontFamily: 'var(--font-display)' }}>{a}</div>
                  <div className="text-[13px] text-white/80">{b}</div>
                </div>
              ))}
            </div>
          </div>

          {/* plan preview card */}
          {plan.length > 0 && (
            <div className="rounded-[22px] bg-white p-6 text-slate shadow-[var(--shadow-lg)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xl font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('Your Refill plan', 'خطة ريفيل الخاصة بك')}</div>
                <span className="rounded-full bg-green-wash px-3 py-1.5 text-xs font-bold text-green-dark">{t('Preview', 'معاينة')}</span>
              </div>
              <div className="flex flex-col gap-3">
                {plan.map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="relative flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-surface">
                      <Image src={p.image} alt="" fill sizes="52px" className="object-contain p-1.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink">{p.name}</div>
                      <div className="text-xs font-semibold text-green-mid">{t(`Every ${p.every} days`, `كل ${p.every} يومًا`)}</div>
                    </div>
                    <div className="font-bold text-green-dark">{formatEGP(refillPrice(p.pricePiastres))}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[color:var(--slate-border)] pt-3.5">
                <span className="text-sm text-[color:var(--text-muted)]">{t(`Per delivery · saved ${formatEGP(planSaved)}`, `لكل توصيلة · وفّرت ${formatEGP(planSaved)}`)}</span>
                <span className="text-2xl font-bold text-green-dark">{formatEGP(planTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-14 sm:px-6 lg:px-8">
        <h2 className="text-center text-[clamp(28px,3.4vw,38px)] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>
          {t('How Veeey Refill works', 'كيف يعمل فيي ريفيل')}
        </h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.t[0]} className="relative rounded-[18px] border border-[color:var(--green-dark-05)] bg-white p-6">
              <span className="absolute end-[18px] top-[18px] text-4xl font-bold text-green-wash" style={{ fontFamily: 'var(--font-display)' }}>{i + 1}</span>
              <span className="inline-flex size-[52px] items-center justify-center rounded-full bg-green-wash">
                <Icon name={s.icon} size={26} color="var(--green-dark)" />
              </span>
              <div className="mt-4 text-[19px] font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>{t(s.t[0], s.t[1])}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--text-muted)]">{t(s.s[0], s.s[1])}</p>
            </div>
          ))}
        </div>
      </section>

      {/* frequency picker + benefits */}
      <section className="mx-auto max-w-[1440px] px-4 pb-2 pt-12 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 rounded-[24px] bg-green-wash p-[clamp(28px,4vw,48px)] lg:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-green-mid">{t('Flexible schedule', 'جدول مرن')}</div>
            <h3 className="mt-2.5 text-[clamp(24px,3vw,32px)] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>
              {t('Delivered exactly when you need it', 'يصل تمامًا حين تحتاجه')}
            </h3>
            <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-[color:var(--text-muted)]">
              {t(
                "Choose how often each product arrives. We'll remind you 3 days before every shipment so nothing's a surprise.",
                'اختر معدّل وصول كل منتج. سنذكّرك قبل ٣ أيام من كل شحنة حتى لا تُفاجأ.',
              )}
            </p>
            <RefillFrequency locale={locale} />
          </div>
          <div className="flex flex-col gap-3.5">
            {benefits.map((b) => (
              <div key={b.t[0]} className="flex items-center gap-3.5 rounded-[14px] bg-white px-[18px] py-3.5">
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-green-wash">
                  <Icon name={b.icon} size={22} color="var(--green-dark)" />
                </span>
                <div>
                  <div className="text-[14.5px] font-bold text-ink">{t(b.t[0], b.t[1])}</div>
                  <div className="text-[13px] text-[color:var(--text-muted)]">{t(b.s[0], b.s[1])}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* popular on refill */}
      {products.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-4 pb-12 pt-12 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-[clamp(24px,3vw,30px)] font-bold text-green-dark" style={{ fontFamily: 'var(--font-display)' }}>{t('Popular on Refill', 'الأكثر رواجًا على ريفيل')}</h2>
            <Link href="/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-dark hover:text-lime-press">
              {t('View all', 'عرض الكل')} <Icon name="arrow-right" size={16} color="var(--green-dark)" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[18px]">
            {products.slice(0, 5).map((p) => (
              <ChewyProductCard key={p.slug} product={p} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
