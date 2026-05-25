import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { MainLayout } from '@/components/layout';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AntdThemeProvider } from '@/components/AntdThemeProvider';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: '数码商城 - Digital Store',
  description: '数码产品独立商城，提供优质数码产品在线购物体验',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AntdRegistry>
            <AntdThemeProvider>
              <MainLayout>{children}</MainLayout>
              <Toaster richColors position="top-center" />
            </AntdThemeProvider>
          </AntdRegistry>
        </ThemeProvider>
      </body>
    </html>
  );
}
