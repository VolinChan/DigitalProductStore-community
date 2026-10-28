'use client';

import React, { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useTheme } from 'next-themes';
import esES from 'antd/es/locale/es_ES';
import enUS from 'antd/es/locale/en_US';
import { useCurrentLocale } from '@/lib/i18n/useCurrentLocale';
import { useAccessibilityPreferences } from '@/lib/accessibility/useAccessibilityPreferences';
import '@/components/accessibility/accessibility.css';

export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const locale = useCurrentLocale();
  const { preferences } = useAccessibilityPreferences();

  useEffect(() => { setMounted(true); }, []);

  const dark = mounted && resolvedTheme === 'dark';
  const algorithm = dark ? theme.darkAlgorithm : theme.defaultAlgorithm;
  const secondaryText = dark ? '#b6c2cf' : '#5c6974';
  const primary = dark ? '#69b1ff' : '#0958d9';

  // Map locale to Ant Design locale
  const antLocale = locale === 'es-CL' ? esES : enUS;

  return (
    <ConfigProvider
      locale={antLocale}
      theme={{
        algorithm,
        token: {
          colorPrimary: preferences.highContrast ? (dark ? '#b4d6ff' : '#004b91') : primary,
          colorLink: dark ? '#91caff' : '#0958d9',
          colorTextSecondary: preferences.highContrast ? (dark ? '#e5edf5' : '#243746') : secondaryText,
          colorTextTertiary: secondaryText,
          colorTextPlaceholder: secondaryText,
          ...(preferences.highContrast ? { colorBorder: dark ? '#9fb3c8' : '#4b6278' } : {}),
          borderRadius: 8,
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: dark ? '#ffb3ad' : '#b42318',
          fontFamily: 'inherit',
          wireframe: false,
        },
        components: {
          Button: { controlHeight: 40 },
          Input: { controlHeight: 40 },
          Select: { controlHeight: 40 },
          Table: { colorTextDisabled: secondaryText },
          Card: { boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)' }
        }
      }}
    >
      {children}
    </ConfigProvider>
  );
}
