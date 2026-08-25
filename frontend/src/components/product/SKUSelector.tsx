'use client';

import React, { useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { SKU, SKUAttribute } from '@/types';

interface SKUSelectorProps {
  /** All SKUs for the product */
  skus: SKU[];
  /** Currently selected SKU (if fully matched) */
  selectedSku: SKU | null;
  /** Current attribute selections: { attributeName: selectedValue } */
  selectedAttributes: Record<string, string>;
  /** Callback when user selects an attribute value */
  onAttributeChange: (name: string, value: string) => void;
  /** Direct selection for operational SKUs that do not define dimensions. */
  onSkuChange?: (sku: SKU) => void;
}

/**
 * SKU attribute selector component.
 * Displays all available attribute types (color, size, etc.) and allows
 * selecting one value per attribute type.
 *
 * Requirements:
 * - 4.1: Display all available SKU attribute options
 * - 4.2: Allow selecting attribute values to identify a specific SKU
 * - 4.5: Update dynamically when selection changes
 */
export default function SKUSelector({
  skus,
  selectedSku,
  selectedAttributes,
  onAttributeChange,
  onSkuChange,
}: SKUSelectorProps) {
  const t = useTranslations();
  // Extract all unique attribute types and their values
  const attributeGroups = useMemo(() => {
    const groups: Record<string, Set<string>> = {};

    skus.forEach((sku) => {
      if (!sku.is_active) return;
      (sku.attributes ?? []).forEach((attr) => {
        if (!groups[attr.name]) {
          groups[attr.name] = new Set();
        }
        groups[attr.name].add(attr.value);
      });
    });

    // Convert to array format preserving insertion order
    return Object.entries(groups).map(([name, values]) => ({
      name,
      values: Array.from(values),
    }));
  }, [skus]);

  // A sparse historical matrix may not contain every cross-product. Attribute
  // choices remain reachable; the parent switches to the closest complete SKU.
  const hasStock = useCallback(
    (attributeName: string, value: string): boolean => {
      return skus.some((sku) => {
        if (!sku.is_active || sku.inventory <= 0) return false;
        return (sku.attributes ?? []).some(
          (attr) => attr.name === attributeName && attr.value === value
        );
      });
    },
    [skus]
  );

  if (attributeGroups.length === 0) {
    const selectable = skus.filter((sku) => sku.is_active);
    if (selectable.length <= 1 || !onSkuChange) return null;
    return (
      <div>
        <label className="mb-2 block text-sm font-black text-[var(--sf-ink)]">
          {t('products.selectSku')}
          {selectedSku && <span className="ml-2 font-normal text-[var(--sf-muted)]">: {selectedSku.sku_code}</span>}
        </label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('products.selectSku')}>
          {selectable.map((sku) => {
            const isSelected = selectedSku?.id === sku.id;
            const inStock = sku.inventory > 0;
            return <button
              key={sku.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`min-h-[44px] min-w-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${isSelected ? 'border-[var(--sf-accent)] bg-[var(--sf-soft-blue)] text-[var(--sf-accent)] ring-1 ring-[var(--sf-accent)]' : inStock ? 'border-[var(--sf-line)] bg-white text-[var(--sf-ink)] hover:border-[var(--sf-accent)] hover:text-[var(--sf-accent)]' : 'border-[var(--sf-line)] bg-white text-[var(--sf-muted)] hover:border-[var(--sf-muted)]'}`}
              onClick={() => onSkuChange(sku)}
            >
              {sku.sku_code}
              {!inStock && <span className="ml-1 text-xs text-[var(--sf-muted)]">({t('common.outOfStock')})</span>}
            </button>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {attributeGroups.map((group) => {
        return (
          <div key={group.name}>
            <label className="mb-2 block text-sm font-black text-[var(--sf-ink)]">
              {group.name}
              {selectedAttributes[group.name] && (
                <span className="ml-2 font-normal text-[var(--sf-muted)]">
                  : {selectedAttributes[group.name]}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={group.name}>
              {group.values.map((value) => {
                const isSelected = selectedAttributes[group.name] === value;
                const isAvailable = skus.some((sku) => sku.is_active && (sku.attributes || []).some((attribute) => attribute.name === group.name && attribute.value === value));
                const inStock = hasStock(group.name, value);
                const isDisabled = !isAvailable;

                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    className={`
                      min-h-[44px] min-w-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition-all
                      ${isSelected
                        ? 'border-[var(--sf-accent)] bg-[var(--sf-soft-blue)] text-[var(--sf-accent)] ring-1 ring-[var(--sf-accent)]'
                        : isDisabled
                          ? 'cursor-not-allowed border-[var(--sf-line)] bg-[var(--sf-soft)] text-[var(--sf-muted)] opacity-45 line-through'
                          : !inStock
                            ? 'cursor-pointer border-[var(--sf-line)] bg-white text-[var(--sf-muted)] hover:border-[var(--sf-muted)]'
                            : 'cursor-pointer border-[var(--sf-line)] bg-white text-[var(--sf-ink)] hover:border-[var(--sf-accent)] hover:text-[var(--sf-accent)]'
                      }
                    `}
                    onClick={() => {
                      if (!isDisabled) {
                        // Radio choices remain selected when clicked again.
                        onAttributeChange(group.name, value);
                      }
                    }}
                  >
                    {value}
                    {!inStock && isAvailable && (
                      <span className="ml-1 text-xs text-[var(--sf-muted)]">({t('common.outOfStock')})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
