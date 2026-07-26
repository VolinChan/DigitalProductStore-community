'use client';

import React from 'react';
import { Button } from 'antd';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * Polished empty state with illustration, description and suggested action.
 * Requirement 36.2: Illustrated empty states with descriptive message.
 */
export default function EmptyState({
  title = '暂无内容',
  description = '这里还没有任何数据',
  actionLabel,
  actionHref,
  icon,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-gray-300 dark:text-gray-600">
        {icon || (
          <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-muted mb-1">{title}</p>
      <p className="text-xs text-muted/70 max-w-xs">{description}</p>
      {actionLabel && (onAction || actionHref) && (
        <Button type="primary" className="mt-6" size="large" onClick={onAction}>
          {actionHref ? <a href={actionHref} className="text-white no-underline">{actionLabel}</a> : actionLabel}
        </Button>
      )}
    </div>
  );
}
