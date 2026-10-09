'use client';

import { useEffect, useState } from 'react';
import { FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Category } from '@/types';
import { buildPublicCategoryTree, type CategoryNode } from '@/lib/category-tree';

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
  onCategoryChange?: (id: number | undefined) => void;
}

export default function ProductFilters({ categories, initialValues, onApply, onReset, onCategoryChange }: ProductFiltersProps) {
  const t = useTranslations();
  const selectedCategory = initialValues.category_id;
  const selectCategory = (id: number | undefined) => onCategoryChange ? onCategoryChange(id) : onApply({ ...initialValues, category_id: id });
  const [minPrice, setMinPrice] = useState<number | undefined>(initialValues.min_price);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(initialValues.max_price);
  const invalidRange = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;
  const hasFilters = selectedCategory !== undefined || minPrice !== undefined || maxPrice !== undefined;

  useEffect(() => {
    setMinPrice(initialValues.min_price);
    setMaxPrice(initialValues.max_price);
  }, [initialValues.max_price, initialValues.min_price]);

  const reset = () => {
    setMinPrice(undefined);
    setMaxPrice(undefined);
    onReset();
  };

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-sm font-black text-[var(--sf-ink)]">{t('products.category')}</legend>
        <div className="space-y-1">
          <FilterChoice active={selectedCategory === undefined} onClick={() => selectCategory(undefined)}>{t('common.viewAll')}</FilterChoice>
          {buildPublicCategoryTree(categories).map((category) => (
            <CategoryGroup key={category.id} category={category} selected={selectedCategory} onSelect={selectCategory} />
          ))}
        </div>
      </fieldset>

      <fieldset className="border-t border-[var(--sf-line)] pt-6">
        <legend className="mb-3 text-sm font-black text-[var(--sf-ink)]">{t('common.price')}</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="min-w-0 text-xs font-semibold text-[var(--sf-muted)]">
            {t('products.minPrice')}
            <PriceInput value={minPrice} onChange={setMinPrice} />
          </label>
          <label className="min-w-0 text-xs font-semibold text-[var(--sf-muted)]">
            {t('products.maxPrice')}
            <PriceInput value={maxPrice} onChange={setMaxPrice} />
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

function CategoryGroup({ category, selected, onSelect }: { category: CategoryNode; selected?: number; onSelect: (id: number) => void }) {
  const [expanded, setExpanded] = useState(true);
  const containsSelected = (node: CategoryNode): boolean => node.id === selected || node.children.some(containsSelected);
  const activeBranch = containsSelected(category);
  useEffect(() => { if (activeBranch) setExpanded(true); }, [activeBranch, selected]);
  return <div className="category-filter-group">
    <div className="flex items-center gap-1">
      <FilterChoice active={selected === category.id} onClick={() => onSelect(category.id)}>{category.name}</FilterChoice>
      {category.children.length > 0 && <button type="button" aria-label={category.name} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="min-h-11 min-w-11 rounded-xl text-[var(--sf-muted)] hover:bg-[var(--sf-soft)]">{expanded ? '−' : '+'}</button>}
    </div>
    {expanded && category.children.length > 0 && <div className="ml-3 border-l border-[var(--sf-line)] pl-2">
      {category.children.map((child) => <CategoryGroup key={child.id} category={child} selected={selected} onSelect={onSelect} />)}
    </div>}
  </div>;
}

function PriceInput({ value, onChange }: { value?: number; onChange: (value: number | undefined) => void }) {
  return <span className="mt-2 flex min-h-12 items-center gap-1 rounded-xl border border-solid border-[var(--sf-line)] bg-white px-3 focus-within:border-[var(--sf-accent)] focus-within:ring-2 focus-within:ring-[var(--sf-accent)]/15">
    <span aria-hidden="true">$</span>
    <input type="text" inputMode="numeric" pattern="[0-9]*" value={value ?? ''} onChange={(event) => {
      const next = event.target.value;
      if (next === '') onChange(undefined);
      else if (/^[0-9]+$/.test(next) && Number.isSafeInteger(Number(next))) onChange(Number(next));
    }} className="min-w-0 w-full border-0 bg-transparent py-3 text-sm text-[var(--sf-ink)] outline-none" />
  </span>;
}

function FilterChoice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition-colors ${active ? 'bg-[var(--sf-soft-blue)] text-[var(--sf-accent)]' : 'text-[var(--sf-subtle)] hover:bg-[var(--sf-soft)]'}`}>
      {children}
    </button>
  );
}
