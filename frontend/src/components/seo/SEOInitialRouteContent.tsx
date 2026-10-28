import { loadHomeSections } from '@/lib/home';
import { CatalogNotFoundError, getPublicCategories, getPublicProductBySlug, getPublicProducts } from '@/lib/server/catalog';
import type { StorefrontLocale } from '@/lib/seo/policy';
import { ServerCategoryContent, ServerHomeContent, ServerProductDetailContent, ServerProductListContent } from './ServerCatalogContent';
import { getTranslations } from 'next-intl/server';
import PublishedLegalDocument, { type LegalDocumentKey } from '@/components/legal/PublishedLegalDocument';
import LegalCenterContent from '@/components/legal/LegalCenterContent';
import ContactContent from '@/components/contact/ContactContent';

function positive(value: string | null, minimum = 1): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum ? number : undefined;
}

export default async function SEOInitialRouteContent({ locale, pathname, search }: { locale: StorefrontLocale; pathname: string; search: string }) {
  if (process.env.SEO_E2E_CLIENT_CATALOG === 'true') return null;
  const relative = pathname.replace(new RegExp(`^/${locale}/?`), '');
  if (relative === '') {
    const categories = await getPublicCategories();
    const sections = await loadHomeSections(categories, getPublicProducts);
    return <ServerHomeContent locale={locale} sections={sections} categories={categories} />;
  }
  if (relative === 'products' || relative === 'recommended') {
    const recommendedOnly = relative === 'recommended';
    const query = new URLSearchParams(search);
    const sort = query.get('sort');
    const sortBy = sort === 'price_asc' || sort === 'price_desc' ? 'price' : sort === 'name_asc' ? 'name' : recommendedOnly && sort !== 'newest' ? 'recommended' : 'created_at';
    const sortOrder = sort === 'price_asc' || sort === 'name_asc' ? 'asc' : 'desc';
    const catalog = await getPublicProducts({
      page: Math.floor(positive(query.get('page')) || 1),
      pageSize: 12,
      sortBy,
      sortOrder,
      ...(recommendedOnly ? { isRecommended: true } : {}),
      categoryId: positive(query.get('category_id')),
      minPrice: positive(query.get('min_price'), 0),
      maxPrice: positive(query.get('max_price'), 0),
    });
    const t = await getTranslations({ locale, namespace: 'products' });
    return <ServerProductListContent locale={locale} products={catalog.products} total={catalog.total} collection={relative} page={Math.floor(positive(query.get('page')) || 1)} search={search} title={recommendedOnly ? t('recommendedTitle') : undefined} description={recommendedOnly ? t('recommendedDescription') : undefined} />;
  }
  if (relative === 'categories') {
    return <ServerCategoryContent locale={locale} categories={await getPublicCategories()} />;
  }
  const legalRoutes: Partial<Record<string, LegalDocumentKey>> = {
    about: 'about', privacy: 'privacy', 'help/shipping': 'shipping', 'help/returns': 'returns_withdrawal',
    'legal/terms': 'terms', 'legal/returns-withdrawal': 'returns_withdrawal', 'legal/legal-guarantee': 'legal_guarantee',
    'legal/cookies': 'cookies', 'legal/supplier': 'supplier_identification',
  };
  const documentKey = legalRoutes[relative];
  if (documentKey) return <PublishedLegalDocument locale={locale} documentKey={documentKey} serverFallback />;
  if (relative === 'legal') return <LegalCenterContent locale={locale} serverFallback />;
  if (relative === 'contact') return <div className="seo-server-content"><ContactContent supplierTitleId="server-supplier-disclosure-title" /></div>;
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
