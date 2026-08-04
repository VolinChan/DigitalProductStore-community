import { CatalogNotFoundError, getPublicCategories, getPublicProductBySlug, getPublicProducts } from '@/lib/server/catalog';
import type { StorefrontLocale } from '@/lib/seo/policy';
import { ServerCategoryContent, ServerHomeContent, ServerProductDetailContent, ServerProductListContent } from './ServerCatalogContent';
import { buildSiteJsonLd, serializeJsonLd } from '@/lib/seo/json-ld';

function positive(value: string | null): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export default async function SEOInitialRouteContent({ locale, pathname, search }: { locale: StorefrontLocale; pathname: string; search: string }) {
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') return null;
  const relative = pathname.replace(new RegExp(`^/${locale}/?`), '');
  if (relative === '') {
    const [catalog, categories] = await Promise.all([getPublicProducts({ page: 1, pageSize: 10 }), getPublicCategories()]);
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildSiteJsonLd(locale)) }} /><ServerHomeContent locale={locale} products={catalog.products} categories={categories} /></>;
  }
  if (relative === 'products') {
    const query = new URLSearchParams(search);
    const sort = query.get('sort');
    const sortBy = sort === 'price_asc' || sort === 'price_desc' ? 'price' : sort === 'name_asc' ? 'name' : 'created_at';
    const sortOrder = sort === 'price_asc' || sort === 'name_asc' ? 'asc' : 'desc';
    const catalog = await getPublicProducts({
      page: positive(query.get('page')) || 1,
      pageSize: 12,
      sortBy,
      sortOrder,
      categoryId: positive(query.get('category_id')),
      minPrice: positive(query.get('min_price')),
      maxPrice: positive(query.get('max_price')),
    });
    return <ServerProductListContent locale={locale} products={catalog.products} total={catalog.total} />;
  }
  if (relative === 'categories') {
    return <ServerCategoryContent locale={locale} categories={await getPublicCategories()} />;
  }
  const staticCopy: Partial<Record<string, Record<StorefrontLocale, { title: string; description: string }>>> = {
    about: {
      'es-CL': { title: 'Acerca de Plexoria', description: 'Tecnología y accesorios con información clara para tomar mejores decisiones de compra.' },
      en: { title: 'About Plexoria', description: 'Technology and accessories with clear information for better purchasing decisions.' },
    },
    contact: {
      'es-CL': { title: 'Contacto', description: 'Contacta al equipo de soporte de Plexoria por teléfono, WhatsApp o correo electrónico.' },
      en: { title: 'Contact', description: 'Contact Plexoria support by phone, WhatsApp, or email.' },
    },
    'help/shipping': {
      'es-CL': { title: 'Información de envíos', description: 'Consulta cómo se calculan y presentan las opciones de envío disponibles.' },
      en: { title: 'Shipping information', description: 'Learn how available shipping options are calculated and presented.' },
    },
  };
  const content = staticCopy[relative]?.[locale];
  if (content) return <main className="seo-server-content store-container"><article className="max-w-3xl"><h1 className="text-4xl font-black">{content.title}</h1><p className="mt-6 text-lg leading-8 text-[var(--sf-subtle)]">{content.description}</p></article></main>;
  const productMatch = relative.match(/^products\/([^/]+)$/);
  if (productMatch && productMatch[1] !== 'search' && !search.includes('preview_token=')) {
    try {
      const product = await getPublicProductBySlug(decodeURIComponent(productMatch[1]));
      return <ServerProductDetailContent locale={locale} product={product} />;
    } catch (error) {
      if (error instanceof CatalogNotFoundError) return null;
      throw error;
    }
  }
  return null;
}
