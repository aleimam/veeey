import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Poppins, Cairo, Playfair_Display, Montserrat } from 'next/font/google';
import localFont from 'next/font/local';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing, localeDirection, type Locale } from '@/i18n/routing';
import { ConsentBanner } from '@/components/consent-banner';
import { ThemeStyle } from '@/components/storefront/theme-style';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { PostHogLoader } from '@/components/analytics/posthog-loader';
import { ClarityLoader } from '@/components/analytics/clarity-loader';
import { GoogleTags } from '@/components/analytics/google-tags';
import '../globals.css';

// Admin fonts (unchanged).
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const cairo = Cairo({
  variable: '--font-cairo',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Storefront fonts (Veeey Design System). Latin: Playfair Display (headings) +
// Montserrat (body). Arabic: GE SS Unique (headings) + GE Dinar Two (body),
// self-hosted from the design-system handoff. Scoped to `.veeey-shop` in CSS.
const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const geUnique = localFont({
  variable: '--font-ge-unique',
  src: '../fonts/GE-SS-Unique-Bold.otf',
  weight: '700',
  display: 'swap',
});

const geDinar = localFont({
  variable: '--font-ge-dinar',
  src: '../fonts/GE-Dinar-Two-Medium.otf',
  weight: '500',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Veeey — Health Inside | Premium supplements & health devices',
  description:
    'Veeey imports premium dietary supplements and health devices directly from the USA, UK and EU. Every product shows its expiry date before you buy.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale.
  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = localeDirection[locale as Locale];

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${poppins.variable} ${cairo.variable} ${playfair.variable} ${montserrat.variable} ${geUnique.variable} ${geDinar.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col font-sans">
        <ThemeStyle />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AnalyticsProvider>
            {children}
            <ConsentBanner />
          </AnalyticsProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
        <PostHogLoader />
        <ClarityLoader />
        <GoogleTags />
      </body>
    </html>
  );
}
