import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { MainLayout } from '@/components/layout';
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
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <MainLayout>{children}</MainLayout>
        </AntdRegistry>
      </body>
    </html>
  );
}
