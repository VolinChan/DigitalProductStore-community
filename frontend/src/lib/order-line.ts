import type { OrderItem } from '@/types';

function formatAttributeValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).trim()
    : '';
}

function formatParsedAttributes(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return '';
        const attribute = entry as { name?: unknown; value?: unknown };
        const name = typeof attribute.name === 'string' ? attribute.name.trim() : '';
        const itemValue = formatAttributeValue(attribute.value);
        return name && itemValue ? `${name}: ${itemValue}` : itemValue;
      })
      .filter(Boolean)
      .join(' · ');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([name, itemValue]) => {
        const text = formatAttributeValue(itemValue);
        return text ? `${name}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' · ');
  }

  return formatAttributeValue(value);
}

export function formatOrderItemAttributes(item: Pick<OrderItem, 'attributes' | 'variant_summary_snapshot'>): string {
  const raw = item.variant_summary_snapshot?.trim() || item.attributes?.trim() || '';
  if (!raw) return '';

  try {
    return formatParsedAttributes(JSON.parse(raw));
  } catch {
    return raw;
  }
}
