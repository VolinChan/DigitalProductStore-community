"use client";

import React, { useEffect } from 'react';
import { Button, Result } from 'antd';
import { useTranslations } from 'next-intl';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Result
        status="500"
        title={t('error.title')}
        subTitle={t('error.subTitle')}
        extra={
          <div className="flex gap-4 justify-center">
            <Button type="primary" onClick={() => reset()} size="large">{t('common.retry')}</Button>
            <Button onClick={() => window.location.href = '/'} size="large">{t('home.browseProducts')}</Button>
          </div>
        }
      />
    </div>
  );
}
