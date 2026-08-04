import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AntdThemeProvider } from '@/components/AntdThemeProvider';
import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSiteConfig } from '@/lib/seo/site-config';
import { NOINDEX_ROBOTS, isStorefrontLocale } from '@/lib/seo/policy';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: getSiteConfig().siteUrl,
  title: 'Plexoria',
  description: 'Tecnología y accesorios seleccionados en Chile.',
  robots: getSiteConfig().indexingEnabled ? { index: true, follow: true } : NOINDEX_ROBOTS,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const localeHeader = (await headers()).get('x-plexoria-locale') || '';
  const lang = isStorefrontLocale(localeHeader) ? localeHeader : 'es-CL';
  return (
    <html lang={lang} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} /></head>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AntdRegistry>
            <AntdThemeProvider>
              {children}
              <Toaster richColors position="top-center" />
            </AntdThemeProvider>
          </AntdRegistry>
        </ThemeProvider>
      </body>
    </html>
  );
}
