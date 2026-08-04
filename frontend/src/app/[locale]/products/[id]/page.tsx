import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ProductDetailClient from '@/components/product/ProductDetailClient';
import { CatalogNotFoundError, getPublicProductBySlug, resolvePublicProductReference } from '@/lib/server/catalog';
import { cleanText } from '@/lib/seo/metadata';
import { getSiteConfig, publicAssetUrl } from '@/lib/seo/site-config';
import { isStorefrontLocale, NOINDEX_ROBOTS, type StorefrontLocale } from '@/lib/seo/policy';
import { productCanonicalUrl, productPath } from '@/lib/seo/urls';
import { buildProductJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';
import { getProductPrimaryImage } from '@/lib/catalog';

type RouteParams = Promise<{ locale: string; id: string }>;
type RouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loadCanonicalProduct(ref: string) {
  if (/^\d+$/.test(ref)) return null;
  try {
    return await getPublicProductBySlug(ref);
  } catch (error) {
    if (!(error instanceof CatalogNotFoundError)) throw error;
    return null;
  }
}

async function redirectOrNotFound(locale: StorefrontLocale, ref: string): Promise<never> {
  try {
    const resolved = await resolvePublicProductReference(ref);
    permanentRedirect(productPath(locale, resolved.current_slug));
  } catch (error) {
    if (error instanceof CatalogNotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params, searchParams }: { params: RouteParams; searchParams: RouteSearchParams }): Promise<Metadata> {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  if (!isStorefrontLocale(locale)) return {};
  const preview = Boolean(first(query.preview_token));
  if (preview || /^\d+$/.test(id)) return { robots: NOINDEX_ROBOTS };
  const product = await loadCanonicalProduct(id);
  if (!product) {
    try {
      await resolvePublicProductReference(id);
      return { robots: NOINDEX_ROBOTS };
    } catch (error) {
      if (error instanceof CatalogNotFoundError) notFound();
      throw error;
    }
  }
  const canonical = productCanonicalUrl(locale, product.slug || id);
  const fallback = locale === 'es-CL'
    ? `Compra ${product.name} en Plexoria. Consulta precio y disponibilidad.`
    : `View ${product.name} at Plexoria. Check current pricing and availability.`;
  const description = cleanText(product.short_description || product.description_html || product.description, 160) || fallback;
  const image = publicAssetUrl(getProductPrimaryImage(product), getSiteConfig().brandShareImage)!;
  const indexable = getSiteConfig().indexingEnabled && locale === 'es-CL';
  return {
    title: product.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website', url: canonical, title: product.name, description,
      locale: locale === 'es-CL' ? 'es_CL' : 'en_US',
      images: [{ url: image, alt: product.name }],
    },
    robots: indexable ? { index: true, follow: true } : NOINDEX_ROBOTS,
  };
}

export default async function ProductPage({ params, searchParams }: { params: RouteParams; searchParams: RouteSearchParams }) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  if (!isStorefrontLocale(locale)) notFound();
  const previewToken = first(query.preview_token);
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') {
    return <div className="seo-interactive-content"><ProductDetailClient productRef={id} previewToken={previewToken} /></div>;
  }
  if (previewToken) {
    return <ProductDetailClient productRef={id} previewToken={previewToken} />;
  }
  const product = await loadCanonicalProduct(id);
  if (!product) return redirectOrNotFound(locale, id);
  if (product.slug && product.slug !== id) permanentRedirect(productPath(locale, product.slug));
  const jsonLd = buildProductJsonLd(product, locale);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="seo-interactive-content"><ProductDetailClient initialProduct={product} productRef={id} /></div>
    </>
  );
}
