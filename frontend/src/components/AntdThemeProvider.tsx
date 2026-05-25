"use client";

import React, { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useTheme } from 'next-themes';
import zhCN from 'antd/locale/zh_CN';

export function AntdThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Use default theme during SSR to avoid hydration mismatch
  const algorithm = mounted && resolvedTheme === 'dark' 
    ? theme.darkAlgorithm 
    : theme.defaultAlgorithm;

  return (
    <ConfigProvider
      locale={zhCN}
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
          Button: {
            controlHeight: 40, // consistent padding and size
          },
          Input: {
            controlHeight: 40,
          },
          Select: {
            controlHeight: 40,
          },
          Card: {
            boxShadowTertiary: '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)', // level-1 shadow
          }
        }
      }}
    >
      {children}
    </ConfigProvider>
  );
}