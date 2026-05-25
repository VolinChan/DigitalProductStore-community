"use client";

import React, { useEffect } from 'react';
import { Button, Result } from 'antd';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Result
        status="500"
        title="出了些问题"
        subTitle="抱歉，加载此页面时发生了错误。请稍后重试。"
        extra={
          <div className="flex gap-4 justify-center">
            <Button type="primary" onClick={() => reset()} size="large">
              重试加载
            </Button>
            <Button onClick={() => window.location.href = '/'} size="large">
              返回首页
            </Button>
          </div>
        }
      />
    </div>
  );
}