import Link from 'next/link';
import Image from 'next/image';
import type { Category, Product } from '@/types';
import type { StorefrontLocale } from '@/lib/seo/policy';
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

export function ServerProductGrid({ products, locale }: { products: Product[]; locale: StorefrontLocale }) {
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const image = getProductPrimaryImage(product);
        const startingPrice = price(product, locale);
        const soldOut = Boolean(product.skus?.length) && product.skus!.every((sku) => sku.inventory <= 0);
        return (
          <article key={product.id}>
            <Link href={productHref(locale, product)} className="block rounded-[18px] bg-white p-4">
              {image && <Image src={image} alt={product.name} width={480} height={480} unoptimized={imageNeedsNoOptimization(image)} className="aspect-square w-full object-contain" sizes="(max-width: 768px) 50vw, 25vw" />}
              <h2 className="mt-3 text-base font-black text-[var(--sf-ink)]">{product.name}</h2>
              {startingPrice && <p className="mt-2 font-bold text-[var(--sf-brand)]">{startingPrice}</p>}
              <p className="mt-1 text-sm text-[var(--sf-muted)]">{soldOut ? (locale === 'es-CL' ? 'Agotado' : 'Sold out') : (locale === 'es-CL' ? 'Disponible' : 'Available')}</p>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

export function ServerHomeContent({ locale, products, categories }: { locale: StorefrontLocale; products: Product[]; categories: Category[] }) {
  return (
    <main className="seo-server-content store-container">
      <section className="rounded-[26px] bg-[#dff1f5] px-6 py-10">
        <h1 className="max-w-3xl text-4xl font-black text-[var(--sf-brand)]">{locale === 'es-CL' ? 'Tecnología útil para todos los días' : 'Useful technology for every day'}</h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--sf-subtle)]">{locale === 'es-CL' ? 'Explora accesorios y productos con precios y disponibilidad claros.' : 'Browse accessories and products with clear pricing and availability.'}</p>
        <Link href={`/${locale}/products`} className="sf-button-primary mt-6">{locale === 'es-CL' ? 'Ver productos' : 'View products'}</Link>
      </section>
      <section className="py-10">
        <h2 className="text-2xl font-black">{locale === 'es-CL' ? 'Categorías' : 'Categories'}</h2>
        <ul className="mt-4 flex flex-wrap gap-3">{categories.map((category) => <li key={category.id}><Link className="sf-button-secondary" href={`/${locale}/products?category_id=${category.id}`}>{category.name}</Link></li>)}</ul>
      </section>
      <section className="pb-12">
        <h2 className="mb-6 text-2xl font-black">{locale === 'es-CL' ? 'Productos destacados' : 'Featured products'}</h2>
        <ServerProductGrid products={products} locale={locale} />
      </section>
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
