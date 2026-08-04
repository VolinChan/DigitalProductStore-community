import type { Product, SKU } from '@/types';
import { getProductPrimaryImage, getSKUImage } from '@/lib/catalog';
import { productCanonicalUrl } from './urls';
import { cleanText } from './metadata';
import type { StorefrontLocale } from './policy';
import { absoluteSiteUrl, getSiteConfig, publicAssetUrl } from './site-config';

const availability = (sku: SKU) => sku.inventory > 0
  ? 'https://schema.org/InStock'
  : 'https://schema.org/OutOfStock';

function variantAttributes(sku: SKU): Record<string, string> {
  return Object.fromEntries((sku.attributes || []).map((attribute) => [attribute.name.toLowerCase(), attribute.value]));
}

function variesByURL(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (['color', 'size', 'material', 'pattern'].includes(normalized)) return `https://schema.org/${normalized}`;
  return absoluteSiteUrl(`/product-attributes/${encodeURIComponent(normalized.replace(/\s+/g, '-'))}`);
}

function offer(product: Product, sku: SKU, locale: StorefrontLocale) {
  const price = Number(sku.price);
  if (!sku.sku_code || !Number.isFinite(price) || price < 0) return undefined;
  return {
    '@type': 'Offer',
    price: price.toFixed(0),
    priceCurrency: 'CLP',
    availability: availability(sku),
    url: productCanonicalUrl(locale, product.slug || String(product.id)),
    itemCondition: product.condition === 'used'
      ? 'https://schema.org/UsedCondition'
      : product.condition === 'refurbished'
        ? 'https://schema.org/RefurbishedCondition'
        : 'https://schema.org/NewCondition',
  };
}

function schemaProduct(product: Product, sku: SKU, locale: StorefrontLocale) {
  const attributes = variantAttributes(sku);
  const image = publicAssetUrl(getSKUImage(sku) || getProductPrimaryImage(product), getSiteConfig().brandShareImage);
  return {
    '@type': 'Product',
    name: product.name,
    sku: sku.sku_code,
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(image ? { image: [image] } : {}),
    ...(attributes.color ? { color: attributes.color } : {}),
    ...(attributes.size ? { size: attributes.size } : {}),
    additionalProperty: (sku.attributes || []).map((attribute) => ({
      '@type': 'PropertyValue', name: attribute.name, value: attribute.value,
    })),
    offers: offer(product, sku, locale),
  };
}

export function buildProductJsonLd(product: Product, locale: StorefrontLocale): Record<string, unknown> {
  const skus = (product.skus || []).filter((sku) => sku.is_active);
  const base = {
    '@context': 'https://schema.org',
    name: product.name,
    description: cleanText(product.short_description || product.description_html || product.description, 500),
    url: productCanonicalUrl(locale, product.slug || String(product.id)),
    productID: String(product.id),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
  };
  const dimensions = product.variant_dimensions || [];
  if (skus.length > 1 && dimensions.length > 0) {
    return {
      ...base,
      '@type': 'ProductGroup',
      productGroupID: String(product.id),
      variesBy: dimensions.map((dimension) => variesByURL(dimension.name)),
      hasVariant: skus.map((sku) => schemaProduct(product, sku, locale)),
    };
  }
  const sku = skus[0];
  return {
    ...base,
    '@type': 'Product',
    ...(sku ? schemaProduct(product, sku, locale) : {}),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildSiteJsonLd(locale: StorefrontLocale): Record<string, unknown> {
  const config = getSiteConfig();
  const home = absoluteSiteUrl(`/${locale}`);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${config.siteUrl.toString()}#organization`,
        name: config.brandName,
        url: config.siteUrl.toString(),
        logo: publicAssetUrl('/plexoria-logo.png'),
      },
      {
        '@type': 'WebSite',
        '@id': `${config.siteUrl.toString()}#website`,
        name: config.brandName,
        url: home,
        inLanguage: locale,
        publisher: { '@id': `${config.siteUrl.toString()}#organization` },
      },
    ],
  };
}
