'use client';

import React from 'react';
import { Select } from 'antd';
import { SortAscendingOutlined } from '@ant-design/icons';

export interface SortValue {
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

interface ProductSortProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Sort options for the product list.
 * Requirement 22.3: Allow sorting by price asc/desc, name alphabetically, and creation date desc.
 */
export const SORT_OPTIONS = [
  { value: 'newest', label: '最新上架', sort_by: 'created_at', sort_order: 'desc' as const },
  { value: 'price_asc', label: '价格从低到高', sort_by: 'price', sort_order: 'asc' as const },
  { value: 'price_desc', label: '价格从高到低', sort_by: 'price', sort_order: 'desc' as const },
  { value: 'name_asc', label: '名称 A-Z', sort_by: 'name', sort_order: 'asc' as const },
];

/**
 * Product sort dropdown component.
 * Requirement 22.3: Sort products by price ascending, price descending, name, and creation date.
 */
export default function ProductSort({ value, onChange }: ProductSortProps) {
  return (
    <div className="flex items-center gap-2">
      <SortAscendingOutlined className="text-gray-500" />
      <Select
        value={value}
        onChange={onChange}
        options={SORT_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        }))}
        className="min-w-[140px]"
        aria-label="排序方式"
      />
    </div>
  );
}
