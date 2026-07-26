'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const t = useTranslations();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-11 h-11" />;

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      className="flex items-center justify-center w-11 h-11 rounded-md text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={t('layout.toggleTheme')}
    >
      {isDark ? '🌙' : '☀️'}
    </button>
  );
}
