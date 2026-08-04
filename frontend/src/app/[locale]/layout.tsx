import { MainLayout } from '@/components/layout';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n/request';
import LocaleDocument from '@/components/i18n/LocaleDocument';
import type { Metadata } from 'next';
import { localizedMetadata } from '@/lib/seo/metadata';
import { headers } from 'next/headers';
import SEOInitialRouteContent from '@/components/seo/SEOInitialRouteContent';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) return {};
  return localizedMetadata(locale as Locale);
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-plexoria-pathname') || `/${locale}`;
  const search = requestHeaders.get('x-plexoria-search') || '';

  return (
    <>
      <SEOInitialRouteContent locale={locale as Locale} pathname={pathname} search={search} />
      <NextIntlClientProvider locale={locale} messages={messages}>
        <LocaleDocument />
        <MainLayout skipNav={messages.layout.skipNav}>{children}</MainLayout>
      </NextIntlClientProvider>
    </>
  );
}
