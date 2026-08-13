'use client';

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
import type { Category } from '@/types';
import ImageFallback from '@/components/ImageFallback';

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

export function getCategoryAncestorImageURLs(category: Category, categories: Category[]): Array<string | null | undefined> {
  const byID = new Map(categories.map((item) => [item.id, item]));
  const urls: Array<string | null | undefined> = [];
  const visited = new Set<number>([category.id]);
  let parentID = category.parent_id;
  while (parentID && !visited.has(parentID)) {
    visited.add(parentID);
    const parent = byID.get(parentID);
    if (!parent) break;
    urls.push(parent.image_asset?.url);
    parentID = parent.parent_id;
  }
  return urls;
}

export function CategoryIcon({
  iconKey,
  ancestorKeys,
  imageUrl,
  ancestorImageUrls,
  label,
  className,
}: {
  iconKey?: string | null;
  ancestorKeys?: Array<string | null | undefined>;
  imageUrl?: string | null;
  ancestorImageUrls?: Array<string | null | undefined>;
  label: string;
  className?: string;
}) {
  const resolvedImageURL = imageUrl || ancestorImageUrls?.find(Boolean);
  if (resolvedImageURL) {
    return (
      <span role="img" aria-label={label} className={`relative overflow-hidden ${className ?? 'block h-full w-full'}`}>
        <ImageFallback src={resolvedImageURL} alt="" fill className="object-contain p-2" sizes="160px" />
      </span>
    );
  }
  const resolved = resolveCategoryIconKey(iconKey, ancestorKeys);
  const Icon = CATEGORY_ICON_REGISTRY[resolved].icon;
  return <span role="img" aria-label={label} className={className}><Icon aria-hidden /></span>;
}
