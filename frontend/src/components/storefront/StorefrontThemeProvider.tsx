'use client';

import { ConfigProvider, theme, type ThemeConfig } from 'antd';
import type { ReactNode } from 'react';
import { useAccessibilityPreferences } from '@/lib/accessibility/useAccessibilityPreferences';

// Keep storefront controls and their portalled dialogs on the same visual
// system. This provider is deliberately outside the admin route tree.
const storefrontTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#173f67',
    colorPrimaryHover: '#0f3151',
    colorPrimaryActive: '#0f3151',
    colorLink: '#126da5',
    colorText: '#1c2733',
    colorTextSecondary: '#5c6974',
    colorBorder: '#dce3e9',
    colorBgContainer: '#ffffff',
    colorError: '#a33a32',
    colorSuccess: '#25806b',
    borderRadius: 12,
    controlHeight: 48,
    controlHeightLG: 48,
    controlHeightSM: 44,
    fontFamily: 'inherit',
  },
  components: {
    Button: {
      controlHeight: 48,
      controlHeightLG: 48,
      controlHeightSM: 44,
      borderRadius: 999,
      borderRadiusLG: 999,
      borderRadiusSM: 999,
      fontWeight: 700,
      paddingInline: 24,
      paddingInlineSM: 16,
      defaultColor: '#173f67',
      defaultBorderColor: '#dce3e9',
      defaultHoverBg: '#e8f4fb',
      defaultHoverColor: '#173f67',
      defaultHoverBorderColor: '#126da5',
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
    },
    Input: { controlHeight: 48 },
    Select: { controlHeight: 48 },
    Modal: { borderRadiusLG: 22 },
    Dropdown: { controlHeight: 44 },
  },
};

export default function StorefrontThemeProvider({ children }: { children: ReactNode }) {
  const { preferences } = useAccessibilityPreferences();
  const selectedTheme = preferences.highContrast ? {
    ...storefrontTheme,
    token: { ...storefrontTheme.token, colorPrimary: '#102a43', colorLink: '#004b91', colorText: '#101828', colorTextSecondary: '#334e68', colorTextPlaceholder: '#334e68', colorBorder: '#526779' },
  } : storefrontTheme;
  return <ConfigProvider theme={selectedTheme}>{children}</ConfigProvider>;
}
