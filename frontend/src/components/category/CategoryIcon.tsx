'use client';

import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  AppstoreOutlined,
  AudioOutlined,
  BulbOutlined,
  CameraOutlined,
  ControlOutlined,
  DesktopOutlined,
  HddOutlined,
  LaptopOutlined,
  MobileOutlined,
  PoweroffOutlined,
  TabletOutlined,
  ToolOutlined,
  UsbOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { Button, Input } from 'antd';
import type { Category } from '@/types';

export const CATEGORY_ICON_KEYS = [
  'usb', 'power', 'mobile', 'tablet', 'laptop', 'monitor', 'peripherals',
  'audio', 'storage', 'network', 'camera', 'smart', 'tools', 'general',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;

export type CategoryIconRegistryEntry = {
  icon: IconComponent;
  labels: { 'es-CL': string; en: string };
};

export const CATEGORY_ICON_REGISTRY: Record<CategoryIconKey, CategoryIconRegistryEntry> = {
  usb: { icon: UsbOutlined, labels: { 'es-CL': 'USB y cables', en: 'USB and cables' } },
  power: { icon: PoweroffOutlined, labels: { 'es-CL': 'Energía y carga', en: 'Power and charging' } },
  mobile: { icon: MobileOutlined, labels: { 'es-CL': 'Teléfonos móviles', en: 'Mobile phones' } },
  tablet: { icon: TabletOutlined, labels: { 'es-CL': 'Tabletas', en: 'Tablets' } },
  laptop: { icon: LaptopOutlined, labels: { 'es-CL': 'Portátiles', en: 'Laptops' } },
  monitor: { icon: DesktopOutlined, labels: { 'es-CL': 'Monitores', en: 'Monitors' } },
  peripherals: { icon: ControlOutlined, labels: { 'es-CL': 'Periféricos', en: 'Peripherals' } },
  audio: { icon: AudioOutlined, labels: { 'es-CL': 'Audio', en: 'Audio' } },
  storage: { icon: HddOutlined, labels: { 'es-CL': 'Almacenamiento', en: 'Storage' } },
  network: { icon: WifiOutlined, labels: { 'es-CL': 'Redes', en: 'Networking' } },
  camera: { icon: CameraOutlined, labels: { 'es-CL': 'Cámaras', en: 'Cameras' } },
  smart: { icon: BulbOutlined, labels: { 'es-CL': 'Dispositivos inteligentes', en: 'Smart devices' } },
  tools: { icon: ToolOutlined, labels: { 'es-CL': 'Herramientas', en: 'Tools' } },
  general: { icon: AppstoreOutlined, labels: { 'es-CL': 'General', en: 'General' } },
};

export function isCategoryIconKey(value?: string | null): value is CategoryIconKey {
  return Boolean(value && Object.prototype.hasOwnProperty.call(CATEGORY_ICON_REGISTRY, value));
}

export function resolveCategoryIconKey(iconKey?: string | null, ancestorKeys: Array<string | null | undefined> = []): CategoryIconKey {
  if (isCategoryIconKey(iconKey)) return iconKey;
  const inherited = ancestorKeys.find(isCategoryIconKey);
  return inherited ?? 'general';
}

export function getCategoryAncestorIconKeys(category: Category, categories: Category[]): Array<string | null | undefined> {
  const byID = new Map(categories.map((item) => [item.id, item]));
  const keys: Array<string | null | undefined> = [];
  const visited = new Set<number>([category.id]);
  let parentID = category.parent_id;
  while (parentID && !visited.has(parentID)) {
    visited.add(parentID);
    const parent = byID.get(parentID);
    if (!parent) break;
    keys.push(parent.icon_key);
    parentID = parent.parent_id;
  }
  return keys;
}

export function CategoryIcon({
  iconKey,
  ancestorKeys,
  label,
  className,
}: {
  iconKey?: string | null;
  ancestorKeys?: Array<string | null | undefined>;
  label: string;
  className?: string;
}) {
  const resolved = resolveCategoryIconKey(iconKey, ancestorKeys);
  const Icon = CATEGORY_ICON_REGISTRY[resolved].icon;
  return <span role="img" aria-label={label} className={className}><Icon aria-hidden /></span>;
}

export function CategoryIconPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange?: (value: CategoryIconKey | null) => void;
}) {
  const [query, setQuery] = useState('');
  const entries = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return CATEGORY_ICON_KEYS.filter((key) => {
      const entry = CATEGORY_ICON_REGISTRY[key];
      return !normalized || key.includes(normalized) || entry.labels.en.toLocaleLowerCase().includes(normalized) || entry.labels['es-CL'].toLocaleLowerCase().includes(normalized);
    });
  }, [query]);

  return (
    <div className="space-y-3">
      <Input.Search
        allowClear
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索图标 / Buscar / Search"
        aria-label="Buscar iconos / Search icons"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="listbox" aria-label="Icono de categoría / Category icon">
        <Button
          className="h-auto min-h-16 whitespace-normal"
          type={value == null ? 'primary' : 'default'}
          aria-label="Sin icono / No icon"
          aria-pressed={value == null}
          onClick={() => onChange?.(null)}
        >
          未设置<br /><span className="text-xs opacity-70">Sin icono / No icon</span>
        </Button>
        {entries.map((key) => {
          const entry = CATEGORY_ICON_REGISTRY[key];
          const Icon = entry.icon;
          const accessibleLabel = `${entry.labels['es-CL']} / ${entry.labels.en}`;
          return (
            <Button
              key={key}
              className="h-auto min-h-16 whitespace-normal"
              type={value === key ? 'primary' : 'default'}
              aria-label={accessibleLabel}
              aria-pressed={value === key}
              onClick={() => onChange?.(key)}
            >
              <span className="flex flex-col items-center gap-1"><Icon aria-hidden /><span>{accessibleLabel}</span><code className="text-[10px] opacity-70">{key}</code></span>
            </Button>
          );
        })}
      </div>
      <div className="flex min-h-10 items-center gap-2 rounded-lg bg-gray-50 px-3 py-2" aria-live="polite">
        <CategoryIcon iconKey={value} label="Vista previa / Preview" className="text-xl" />
        <span className="text-sm">预览：{value && isCategoryIconKey(value) ? `${CATEGORY_ICON_REGISTRY[value].labels['es-CL']} / ${CATEGORY_ICON_REGISTRY[value].labels.en}` : 'Sin icono / No icon'}</span>
      </div>
    </div>
  );
}
