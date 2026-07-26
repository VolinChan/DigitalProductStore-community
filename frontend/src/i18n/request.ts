import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['es-CL', 'en'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  // Route validation happens in app/[locale]/layout.tsx. A request can reach
  // this config before middleware supplies a locale, so use the storefront
  // default rather than turning otherwise valid locale routes into a 404.
  const locale = (await requestLocale) ?? 'es-CL';
  if (!locales.includes(locale as Locale)) notFound();

  return {
    locale: locale as Locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
