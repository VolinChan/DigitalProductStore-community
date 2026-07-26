import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
      mobile: { max: '767px' },
      tablet: { min: '768px', max: '1023px' },
      desktop: { min: '1024px' },
      },
      colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      card: {
        DEFAULT: 'var(--card-bg)',
        border: 'var(--card-border)',
      },
      muted: 'var(--muted)',
      accent: {
        DEFAULT: 'var(--accent)',
        hover: 'var(--accent-hover)',
      },
      primary: {
        light: '#eff6ff',
        DEFAULT: '#2563eb',
        dark: '#1d4ed8',
      },
      secondary: {
        light: '#f1f5f9',
        DEFAULT: '#475569',
        dark: '#334155',
      },
      success: {
        light: '#f0fdf4',
        DEFAULT: '#16a34a',
        dark: '#15803d',
      },
      warning: {
        light: '#fffbeb',
        DEFAULT: '#d97706',
        dark: '#b45309',
      },
      error: {
        light: '#fef2f2',
        DEFAULT: '#dc2626',
        dark: '#b91c1c',
      },
      },
      spacing: {
      '1': '4px',
      '2': '8px',
      '3': '12px',
      '4': '16px',
      '6': '24px',
      '8': '32px',
      '10': '40px',
      '12': '48px',
      '16': '64px',
      },
      borderRadius: {
      sm: '6px',
      md: '8px',
      lg: '12px',
      xl: '16px',
      pill: '9999px',
      },
      boxShadow: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
      card: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
      'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      },
      fontSize: {
      base: '16px',
      caption: '12px',
      sm: '14px',
      xs: '12px',
      h6: '20px',
      h5: '24px',
      h4: '28px',
      h3: '32px',
      h2: '36px',
      h1: '42px',
      },
      fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        "'Segoe UI'",
        "'PingFang SC'",
        "'Hiragino Sans GB'",
        "'Microsoft YaHei'",
        'sans-serif',
      ],
      mono: ['ui-monospace', 'SFMono-Regular', "'SF Mono'", 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};

export default config;
