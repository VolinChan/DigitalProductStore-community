"use client";

import React from 'react';
import { Empty, Button } from 'antd';
import { useRouter } from 'next/navigation';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({ 
  title = '暂无数据', 
  description = '未找到相关内容', 
  actionText,
  onAction,
  actionHref
}: EmptyStateProps) {
  const router = useRouter();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      router.push(actionHref);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 w-full min-h-[400px]">
      <Empty
        description={
          <div className="text-center">
            <h3 className="text-h6 text-foreground font-medium mb-2">{title}</h3>
            <p className="text-secondary mb-4">{description}</p>
          </div>
        }
      >
        {(actionText && (onAction || actionHref)) && (
          <Button type="primary" onClick={handleAction} size="large">
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
}