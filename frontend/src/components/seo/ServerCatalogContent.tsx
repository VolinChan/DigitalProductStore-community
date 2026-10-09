import Link from 'next/link';
import Image from 'next/image';
import type { Category, Product } from '@/types';
import type { StorefrontLocale } from '@/lib/seo/policy';
import { buildPublicCategoryTree } from '@/lib/category-tree';
import { HOME_CATEGORY_LIMIT, HOME_COMPACT_PRODUCTS_PER_SECTION, type HomeProductSection } from '@/lib/home';
import { getProductPrimaryImage } from '@/lib/catalog';

function productHref(locale: StorefrontLocale, product: Product): string {
  return `/${locale}/products/${encodeURIComponent(product.slug || String(product.id))}`;
}

function imageNeedsNoOptimization(source: string): boolean {
  return source.startsWith('data:') || source.startsWith('/uploads/') || /\.svg(?:\?|$)/i.test(source);
}

function price(product: Product, locale: StorefrontLocale): string | undefined {
  const values = (product.skus || []).filter((sku) => sku.is_active).map((sku) => Number(sku.price)).filter(Number.isFinite);
  if (!values.length) return undefined;
  return new Intl.NumberFormat(locale === 'es-CL' ? 'es-CL' : 'en-US', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.min(...values));
}

export function ServerProductGrid({ products, locale, home = false }: { products: Product[]; locale: StorefrontLocale; home?: boolean }) {
  const Heading = home ? 'h3' : 'h2';
  return (
    <div className={home ? "grid grid-cols-2 gap-5 lg:grid-cols-4 xl:grid-cols-5" : "grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4"}>
      {products.map((product, index) => {
        const image = getProductPrimaryImage(product);
        const startingPrice = price(product, locale);
        const soldOut = Boolean(product.skus?.length) && product.skus!.every((sku) => sku.inventory <= 0);
        return (
          <article key={product.id} className={home && index >= HOME_COMPACT_PRODUCTS_PER_SECTION ? 'hidden xl:block' : undefined}>
            <Link href={productHref(locale, product)} className="block rounded-[18px] bg-white p-4">
              {image && <Image src={image} alt={product.name} width={480} height={480} unoptimized={imageNeedsNoOptimization(image)} className="aspect-square w-full object-contain" sizes="(max-width: 768px) 50vw, 25vw" />}
              <Heading className="mt-3 text-base font-black text-[var(--sf-ink)]">{product.name}</Heading>
              {home && product.is_recommended && <span className="text-xs text-[var(--sf-accent)]">{locale === 'es-CL' ? 'Recomendado' : 'Recommended'}</span>}
              {startingPrice && <p className="mt-2 font-bold text-[var(--sf-brand)]">{startingPrice}</p>}
              <p className="mt-1 text-sm text-[var(--sf-muted)]">{soldOut ? (locale === 'es-CL' ? 'Agotado' : 'Sold out') : (locale === 'es-CL' ? 'Disponible' : 'Available')}</p>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function ServerHomeContent({ locale, sections, categories }: { locale: StorefrontLocale; sections: HomeProductSection[]; categories: Category[] }) {
  const roots = buildPublicCategoryTree(categories).slice(0, HOME_CATEGORY_LIMIT - 1);
  return (
    <main className="seo-server-content store-container">
      <h1 className="sr-only lg:not-sr-only lg:text-4xl lg:font-black">{locale === 'es-CL' ? 'PLEXORIA · Tecnología y accesorios' : 'PLEXORIA · Technology and accessories'}</h1>
      <nav className="py-8" aria-label={locale === 'es-CL' ? 'Categorías' : 'Categories'}>
        <ul className="flex flex-wrap gap-3">
          {roots.map((category) => <li key={category.id}><Link className="sf-button-secondary" href={`/${locale}/products?category_id=${category.id}`}>{category.name}</Link></li>)}
          {roots.length > 0 && <li><Link className="sf-button-secondary" href={`/${locale}/categories`}>{locale === 'es-CL' ? 'Todas las categorías' : 'All categories'}</Link></li>}
        </ul>
      </nav>
      {sections.map(section => (
        <section key={section.category.id} className="pb-12" aria-labelledby={`server-home-category-${section.category.id}`}>
          <h2 id={`server-home-category-${section.category.id}`} className="mb-6 text-2xl font-black"><Link href={`/${locale}/products?category_id=${section.category.id}`}>{section.category.name}</Link></h2>
          <ServerProductGrid products={section.products} locale={locale} home />
        </section>
      ))}
    </main>
  );
}

export function ServerProductListContent({ locale, products, total }: { locale: StorefrontLocale; products: Product[]; total: number }) {
  return (
    <main className="seo-server-content store-container">
      <h1 className="text-4xl font-black">{locale === 'es-CL' ? 'Productos de tecnología y accesorios' : 'Technology products and accessories'}</h1>
      <p className="mb-8 mt-3 text-[var(--sf-muted)]">{total} {locale === 'es-CL' ? 'resultados' : 'results'}</p>
      <ServerProductGrid products={products} locale={locale} />
    </main>
  );
}

export function ServerCategoryContent({ locale, categories }: { locale: StorefrontLocale; categories: Category[] }) {
  return (
    <main className="seo-server-content store-container">
      <h1 className="text-4xl font-black">{locale === 'es-CL' ? 'Categorías de productos' : 'Product categories'}</h1>
      <p className="mt-3 text-[var(--sf-muted)]">{locale === 'es-CL' ? 'Explora tecnología y accesorios por categoría.' : 'Browse technology and accessories by category.'}</p>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{categories.map((category) => <article key={category.id} className="rounded-[18px] bg-white p-5"><h2 className="font-black"><Link href={`/${locale}/products?category_id=${category.id}`}>{category.name}</Link></h2>{typeof category.product_count === 'number' && <p className="mt-2 text-sm text-[var(--sf-muted)]">{category.product_count} {locale === 'es-CL' ? 'productos' : 'products'}</p>}</article>)}</div>
    </main>
  );
}

export function ServerProductDetailContent({ locale, product }: { locale: StorefrontLocale; product: Product }) {
  const values = (product.skus || []).filter((sku) => sku.is_active).map((sku) => Number(sku.price)).filter(Number.isFinite);
  const minPrice = values.length ? Math.min(...values) : undefined;
  const available = (product.skus || []).some((sku) => sku.is_active && sku.inventory > 0);
  const image = getProductPrimaryImage(product);
  return (
    <main className="seo-server-content store-container">
      <nav aria-label={locale === 'es-CL' ? 'Migas de pan' : 'Breadcrumb'}><Link href={`/${locale}`}>{locale === 'es-CL' ? 'Inicio' : 'Home'}</Link> / <Link href={`/${locale}/products`}>{locale === 'es-CL' ? 'Productos' : 'Products'}</Link> / {product.name}</nav>
      <article className="mt-6 grid gap-8 lg:grid-cols-2">
        {image && <Image src={image} alt={product.name} width={800} height={800} priority unoptimized={imageNeedsNoOptimization(image)} className="aspect-square w-full rounded-[24px] bg-white object-contain p-6" sizes="(max-width: 1024px) 100vw, 50vw" />}
        <div>
          {product.brand && <p className="font-bold uppercase text-[var(--sf-muted)]">{product.brand}</p>}
          <h1 className="mt-2 text-4xl font-black">{product.name}</h1>
          {minPrice !== undefined && <p className="mt-6 text-3xl font-black text-[var(--sf-brand)]">{new Intl.NumberFormat(locale === 'es-CL' ? 'es-CL' : 'en-US', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(minPrice)}</p>}
          <p className="mt-2 font-bold">{available ? (locale === 'es-CL' ? 'Disponible' : 'Available') : (locale === 'es-CL' ? 'Agotado' : 'Sold out')}</p>
          {(product.short_description || product.description) && <p className="mt-8 leading-7 text-[var(--sf-subtle)]">{product.short_description || product.description}</p>}
        </div>
      </article>
    </main>
  );
}
