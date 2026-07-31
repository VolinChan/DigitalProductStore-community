'use client';

import React from 'react';
import { Select } from 'antd';
import { SortAscendingOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export interface SortValue {
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

/**
 * Query mapping shared with the product list. Labels are intentionally kept
 * out of this data so the visible select remains translated by this component.
 */
export const SORT_OPTIONS = [
  { value: 'newest', sort_by: 'created_at', sort_order: 'desc' as const },
  { value: 'price_asc', sort_by: 'price', sort_order: 'asc' as const },
  { value: 'price_desc', sort_by: 'price', sort_order: 'desc' as const },
  { value: 'name_asc', sort_by: 'name', sort_order: 'asc' as const },
];

interface ProductSortProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Product sort dropdown component.
 */
export default function ProductSort({ value, onChange }: ProductSortProps) {
  const t = useTranslations();

  return (
    <div className="flex min-h-11 items-center gap-2 rounded-full bg-[var(--sf-soft)] pl-3">
      <SortAscendingOutlined className="text-[var(--sf-muted)]" />
      <Select
        value={value}
        onChange={onChange}
        options={[
          { value: 'newest', label: t('products.sortByNewest') },
          { value: 'price_asc', label: t('products.sortByPriceLow') },
          { value: 'price_desc', label: t('products.sortByPriceHigh') },
          { value: 'name_asc', label: t('products.sortByName') },
        ]}
        variant="borderless"
        className="min-w-[142px]"
        aria-label={t('products.sort')}
      />
    </div>
  );
}
