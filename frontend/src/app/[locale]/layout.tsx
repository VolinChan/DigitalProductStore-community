import { MainLayout } from '@/components/layout';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n/request';
import LocaleDocument from '@/components/i18n/LocaleDocument';

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

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LocaleDocument />
      <MainLayout>{children}</MainLayout>
    </NextIntlClientProvider>
  );
}
