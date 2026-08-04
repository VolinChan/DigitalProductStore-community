import type { OrderItem } from '@/types';

function formatParsedAttributes(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return '';
        const attribute = entry as { name?: unknown; value?: unknown };
        const name = typeof attribute.name === 'string' ? attribute.name.trim() : '';
        const itemValue = typeof attribute.value === 'string' ? attribute.value.trim() : '';
        return name && itemValue ? `${name}: ${itemValue}` : itemValue;
      })
      .filter(Boolean)
      .join(' · ');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, itemValue]) => itemValue !== null && itemValue !== undefined && String(itemValue).trim())
      .map(([name, itemValue]) => `${name}: ${String(itemValue).trim()}`)
      .join(' · ');
  }

  return '';
}

export function formatOrderItemAttributes(item: Pick<OrderItem, 'attributes' | 'variant_summary_snapshot'>): string {
  const raw = (item.variant_summary_snapshot || item.attributes || '').trim();
  if (!raw || raw === '{}') return '';

  try {
    return formatParsedAttributes(JSON.parse(raw)) || raw;
  } catch {
    return raw;
  }
}
