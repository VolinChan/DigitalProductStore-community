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

  // Determine which attribute values are available given current selections
  const getAvailableValues = useCallback(
    (attributeName: string): Set<string> => {
      const available = new Set<string>();

      skus.forEach((sku) => {
        if (!sku.is_active) return;

        // Check if this SKU matches all OTHER selected attributes
        const matchesOtherSelections = Object.entries(selectedAttributes).every(
          ([name, value]) => {
            if (name === attributeName) return true; // Skip the current attribute
            return (sku.attributes ?? []).some(
              (attr) => attr.name === name && attr.value === value
            );
          }
        );

        if (matchesOtherSelections) {
          // This SKU is compatible, so its value for this attribute is available
          const attr = (sku.attributes ?? []).find((a) => a.name === attributeName);
          if (attr) {
            available.add(attr.value);
          }
        }
      });

      return available;
    },
    [skus, selectedAttributes]
  );

  // Check if a specific value has stock (considering current selections)
  const hasStock = useCallback(
    (attributeName: string, value: string): boolean => {
      return skus.some((sku) => {
        if (!sku.is_active) return false;
        if (sku.inventory <= 0) return false;

        // Check this attribute matches
        const hasThisAttr = (sku.attributes ?? []).some(
          (attr) => attr.name === attributeName && attr.value === value
        );
        if (!hasThisAttr) return false;

        // Check all other selected attributes match
        return Object.entries(selectedAttributes).every(([name, val]) => {
          if (name === attributeName) return true;
          return (sku.attributes ?? []).some(
            (attr) => attr.name === name && attr.value === val
          );
        });
      });
    },
    [skus, selectedAttributes]
  );

  if (attributeGroups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {attributeGroups.map((group) => {
        const availableValues = getAvailableValues(group.name);

        return (
          <div key={group.name}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {group.name}
              {selectedAttributes[group.name] && (
                <span className="ml-2 text-gray-500 font-normal">
                  : {selectedAttributes[group.name]}
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={group.name}>
              {group.values.map((value) => {
                const isSelected = selectedAttributes[group.name] === value;
                const isAvailable = availableValues.has(value);
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
                      px-4 py-2 text-sm rounded-md border transition-all min-w-[44px] min-h-[44px]
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium ring-1 ring-blue-500'
                        : isDisabled
                          ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed line-through'
                          : !inStock
                            ? 'border-gray-300 bg-white text-gray-400 cursor-pointer hover:border-gray-400'
                            : 'border-gray-300 bg-white text-gray-700 cursor-pointer hover:border-blue-400 hover:text-blue-600'
                      }
                    `}
                    onClick={() => {
                      if (!isDisabled) {
                        // Toggle: if already selected, deselect
                        if (isSelected) {
                          onAttributeChange(group.name, '');
                        } else {
                          onAttributeChange(group.name, value);
                        }
                      }
                    }}
                  >
                    {value}
                    {!inStock && isAvailable && (
                      <span className="ml-1 text-xs text-gray-400">({t('common.outOfStock')})</span>
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
