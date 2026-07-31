'use client';

import { useEffect, useState } from 'react';
import { InputNumber } from 'antd';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Category } from '@/types';

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

export default function ProductFilters({ categories, initialValues, onApply, onReset }: ProductFiltersProps) {
  const t = useTranslations();
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>(initialValues.category_id);
  const [minPrice, setMinPrice] = useState<number | undefined>(initialValues.min_price);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(initialValues.max_price);
  const invalidRange = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;
  const hasFilters = selectedCategory !== undefined || minPrice !== undefined || maxPrice !== undefined;

  useEffect(() => {
    setSelectedCategory(initialValues.category_id);
    setMinPrice(initialValues.min_price);
    setMaxPrice(initialValues.max_price);
  }, [initialValues.category_id, initialValues.max_price, initialValues.min_price]);

  const reset = () => {
    setSelectedCategory(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    onReset();
  };

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-sm font-black text-[var(--sf-ink)]">{t('products.category')}</legend>
        <div className="space-y-1">
          <FilterChoice active={selectedCategory === undefined} onClick={() => setSelectedCategory(undefined)}>{t('common.viewAll')}</FilterChoice>
          {categories.map((category) => (
            <FilterChoice key={category.id} active={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)}>{category.name}</FilterChoice>
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t border-[var(--sf-line)] pt-6">
        <legend className="mb-3 text-sm font-black text-[var(--sf-ink)]">{t('common.price')}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs font-semibold text-[var(--sf-muted)]">
            {t('products.minPrice')}
            <InputNumber min={0} value={minPrice} onChange={(value) => setMinPrice(value ?? undefined)} prefix="$" className="mt-2 !w-full" controls={false} />
          </label>
          <label className="min-w-0 text-xs font-semibold text-[var(--sf-muted)]">
            {t('products.maxPrice')}
            <InputNumber min={0} value={maxPrice} onChange={(value) => setMaxPrice(value ?? undefined)} prefix="$" className="mt-2 !w-full" controls={false} />
          </label>
        </div>
      </fieldset>

      <div className="space-y-2 border-t border-[var(--sf-line)] pt-6">
        {invalidRange && <p role="alert" className="text-xs font-semibold text-[#a33a32]">{t('products.priceRangeInvalid')}</p>}
        <button type="button" disabled={invalidRange} onClick={() => onApply({ category_id: selectedCategory, min_price: minPrice, max_price: maxPrice })} className="sf-button-primary w-full">
          <FilterOutlined />{t('products.applyFilters')}
        </button>
        {hasFilters && (
          <button type="button" onClick={reset} className="sf-button-secondary w-full">
            <ReloadOutlined />{t('products.clearFilters')}
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChoice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition-colors ${active ? 'bg-[var(--sf-soft-blue)] text-[var(--sf-accent)]' : 'text-[var(--sf-subtle)] hover:bg-[var(--sf-soft)]'}`}>
      {children}
    </button>
  );
}
