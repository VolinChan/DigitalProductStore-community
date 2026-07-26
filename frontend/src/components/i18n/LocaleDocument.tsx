'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

/** Keeps the document language accurate after client-side locale navigation. */
export default function LocaleDocument() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
