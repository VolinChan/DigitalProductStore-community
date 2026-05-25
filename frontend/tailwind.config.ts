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
        primary: {
          light: '#f0f5ff',
          DEFAULT: '#1677ff',
          dark: '#0958d9',
        },
        secondary: {
          light: '#f5f5f5',
          DEFAULT: '#595959',
          dark: '#262626',
        },
        accent: {
          light: '#fff0f6',
          DEFAULT: '#2f54eb',
          dark: '#1d39c4',
        },
        success: {
          light: '#f6ffed',
          DEFAULT: '#52c41a',
          dark: '#389e0d',
        },
        warning: {
          light: '#fffbe6',
          DEFAULT: '#faad14',
          dark: '#d48806',
        },
        error: {
          light: '#fff2f0',
          DEFAULT: '#ff4d4f',
          dark: '#cf1322',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
        '12': '48px',
        '16': '64px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'pill': '9999px',
      },
      boxShadow: {
        'level-1': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        'level-2': '0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
        'level-3': '0 6px 16px -8px rgba(0, 0, 0, 0.08), 0 9px 28px 0 rgba(0, 0, 0, 0.05), 0 12px 48px 16px rgba(0, 0, 0, 0.03)',
        'level-4': '0 9px 28px -12px rgba(0, 0, 0, 0.1), 0 16px 48px 0 rgba(0, 0, 0, 0.08), 0 24px 80px 24px rgba(0, 0, 0, 0.06)',
      },
      fontSize: {
        'base': '16px',
        'h6': '20px',
        'h5': '25px',
        'h4': '31.25px',
        'h3': '39.06px',
        'h2': '48.83px',
        'h1': '61.04px',
        'caption': '12.8px',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};

export default config;
