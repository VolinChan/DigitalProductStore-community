'use client';

import React, { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useTheme } from 'next-themes';
import esES from 'antd/es/locale/es_ES';
import enUS from 'antd/es/locale/en_US';
import { useCurrentLocale } from '@/lib/i18n/useCurrentLocale';

export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const locale = useCurrentLocale();

  useEffect(() => { setMounted(true); }, []);

  const algorithm = mounted && resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;

  // Map locale to Ant Design locale
  const antLocale = locale === 'es-CL' ? esES : enUS;

  return (
    <ConfigProvider
      locale={antLocale}
      theme={{
        algorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
          fontFamily: 'inherit',
          wireframe: false,
        },
        components: {
          Button: { controlHeight: 40 },
          Input: { controlHeight: 40 },
          Select: { controlHeight: 40 },
          Card: { boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)' }
        }
      }}
    >
      {children}
    </ConfigProvider>
  );
}
