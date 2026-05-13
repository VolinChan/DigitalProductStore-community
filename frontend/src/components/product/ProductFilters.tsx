'use client';

import React, { useState } from 'react';
import { InputNumber, Button, Space, Typography, Divider } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Category } from '@/types';

const { Title, Text } = Typography;

export interface FilterValues {
  category_id?: number;
  min_price?: number;
  max_price?: number;
}

interface ProductFiltersProps {
  categories: Category[];
  initialValues: FilterValues;
  onApply: (values: FilterValues) => void;
  onReset: () => void;
}

/**
 * Product filter sidebar component.
 * Provides category selection and price range filtering.
 * Requirements: 5.2 (category filter), 22.2 (filter by category, price range, availability)
 */
export default function ProductFilters({
  categories,
  initialValues,
  onApply,
  onReset,
}: ProductFiltersProps) {
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(
    initialValues.category_id
  );
  const [minPrice, setMinPrice] = useState<number | undefined>(initialValues.min_price);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(initialValues.max_price);

  const handleApply = () => {
    onApply({
      category_id: selectedCategory,
      min_price: minPrice,
      max_price: maxPrice,
    });
  };

  const handleReset = () => {
    setSelectedCategory(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    onReset();
  };

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div>
        <Title level={5} className="!mb-3">
          <FilterOutlined className="mr-2" />
          商品分类
        </Title>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
              selectedCategory === undefined
                ? 'bg-blue-50 text-blue-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            aria-pressed={selectedCategory === undefined}
          >
            全部分类
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              aria-pressed={selectedCategory === category.id}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <Divider className="!my-4" />

      {/* Price Range Filter */}
      <div>
        <Title level={5} className="!mb-3">
          价格范围
        </Title>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <InputNumber
              placeholder="最低价"
              min={0}
              value={minPrice}
              onChange={(val) => setMinPrice(val ?? undefined)}
              className="flex-1"
              prefix="¥"
              size="middle"
              aria-label="最低价格"
            />
            <Text type="secondary">-</Text>
            <InputNumber
              placeholder="最高价"
              min={0}
              value={maxPrice}
              onChange={(val) => setMaxPrice(val ?? undefined)}
              className="flex-1"
              prefix="¥"
              size="middle"
              aria-label="最高价格"
            />
          </div>
        </div>
      </div>

      <Divider className="!my-4" />

      {/* Action Buttons */}
      <Space direction="vertical" className="w-full">
        <Button
          type="primary"
          icon={<FilterOutlined />}
          onClick={handleApply}
          block
        >
          应用筛选
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleReset}
          block
        >
          重置筛选
        </Button>
      </Space>
    </div>
  );
}
