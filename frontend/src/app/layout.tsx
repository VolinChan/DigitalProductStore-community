import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AntdThemeProvider } from '@/components/AntdThemeProvider';
import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PLEXORIA',
  description: 'Soluciones tecnol\u00f3gicas para tu d\u00eda a d\u00eda',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
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
