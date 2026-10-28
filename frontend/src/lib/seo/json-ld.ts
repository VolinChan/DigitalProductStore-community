import type { Product, SKU } from '@/types';
import { getProductPrimaryImage, getSKUImage } from '@/lib/catalog';
import { canonicalUrl, productCanonicalUrl } from './urls';
import { cleanText } from './metadata';
import { STOREFRONT_LOCALES, type StorefrontLocale } from './policy';
import { absoluteSiteUrl, getSiteConfig, publicAssetUrl } from './site-config';
import { supplierProfile } from '@/lib/legal/supplier';
import { marketplaces } from '@/lib/brand/marketplaces';

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
    seller: { '@id': `${getSiteConfig().siteUrl.toString()}#organization` },
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
    '@id': `${productCanonicalUrl(locale, product.slug || String(product.id))}#product`,
    name: product.name,
    description: cleanText(product.short_description || product.description_html || product.description, 500),
    url: productCanonicalUrl(locale, product.slug || String(product.id)),
    productID: String(product.id),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.model ? { model: product.model } : {}),
    additionalProperty: (product.structured_specifications || [])
      .filter(spec => spec.value_text?.trim() || spec.value_number !== undefined)
      .map(spec => ({ '@type': 'PropertyValue', name: spec.label, value: spec.value_text ?? spec.value_number, ...(spec.unit ? { unitText: spec.unit } : {}) })),
  };
  const dimensions = product.variant_dimensions || [];
  if (skus.length > 1 && dimensions.length > 0) {
    return {
      ...base,
      '@type': 'ProductGroup',
      productGroupID: String(product.id),
      variesBy: dimensions.map((dimension) => variesByURL(dimension.name)),
      hasVariant: skus.map((sku) => ({ ...schemaProduct(product, sku, locale), isVariantOf: { '@id': base['@id'] } })),
    };
  }
  const sku = skus[0];
  const variant = sku ? schemaProduct(product, sku, locale) : undefined;
  return {
    ...base,
    '@type': 'Product',
    ...(variant ? { ...variant, additionalProperty: [...base.additionalProperty, ...variant.additionalProperty] } : {}),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildSiteJsonLd(): Record<string, unknown> {
  const config = getSiteConfig();
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${config.siteUrl.toString()}#organization`,
        name: config.brandName,
        legalName: supplierProfile.legalName,
        url: config.siteUrl.toString(),
        logo: { '@type': 'ImageObject', url: publicAssetUrl('/plexoria-icon.svg'), width: 512, height: 512 },
        email: supplierProfile.supportEmail,
        telephone: supplierProfile.phoneHref,
        address: { '@type': 'PostalAddress', ...supplierProfile.postalAddress },
        sameAs: marketplaces.map(marketplace => marketplace.href),
      },
      {
        '@type': 'WebSite',
        '@id': `${config.siteUrl.toString()}#website`,
        name: config.brandName,
        url: config.siteUrl.toString(),
        inLanguage: STOREFRONT_LOCALES,
        publisher: { '@id': `${config.siteUrl.toString()}#organization` },
      },
    ],
  };
}

export function buildCollectionJsonLd({ locale, path, name, description, products }: { locale: StorefrontLocale; path: string; name: string; description: string; products: Product[] }): Record<string, unknown> {
  const url = canonicalUrl(locale, path);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url, name, description, inLanguage: locale,
    isPartOf: { '@id': `${getSiteConfig().siteUrl.toString()}#website` },
    publisher: { '@id': `${getSiteConfig().siteUrl.toString()}#organization` },
    breadcrumb: buildBreadcrumbJsonLd(locale, path, name),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem', position: index + 1, name: product.name,
        url: productCanonicalUrl(locale, product.slug || String(product.id)),
      })),
    },
  };
}

export function buildBreadcrumbJsonLd(locale: StorefrontLocale, path: string, name: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: locale === 'es-CL' ? 'Inicio' : 'Home', item: canonicalUrl(locale) },
      ...(path.startsWith('products/') ? [{ '@type': 'ListItem', position: 2, name: locale === 'es-CL' ? 'Productos' : 'Products', item: canonicalUrl(locale, 'products') }] : []),
      { '@type': 'ListItem', position: path.startsWith('products/') ? 3 : 2, name, item: canonicalUrl(locale, path) },
    ],
  };
}
