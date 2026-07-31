'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import ImageFallback from '@/components/ImageFallback';
import apiClient from '@/lib/api';
import { getProductPrimaryImage } from '@/lib/catalog';
import type { Category, Product } from '@/types';

interface ProductListResponse {
  data: { products: Product[] };
}

interface CategoryListResponse {
  data: { categories: Category[] };
}

const fallbackCategories = [
  'Cables y adaptadores',
  'Cargadores',
  'Teclados y mouse',
  'Almacenamiento',
  'Redes y conexión',
  'Audio',
];

const categoryIcons = [
  <CableIcon key="cable" />,
  <BoltIcon key="bolt" />,
  <MouseIcon key="mouse" />,
  <StorageIcon key="storage" />,
  <WifiIcon key="wifi" />,
  <HeadphonesIcon key="audio" />,
];

export default function StorefrontDemoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const visualTimeout = window.setTimeout(() => {
      if (active) setLoading(false);
    }, 1400);

    Promise.allSettled([
      apiClient.get<ProductListResponse>('/products', { params: { page: 1, page_size: 10 } }),
      apiClient.get<CategoryListResponse>('/categories'),
    ]).then(([productsResult, categoriesResult]) => {
      if (!active) return;
      if (productsResult.status === 'fulfilled') {
        setProducts(productsResult.value.data.data?.products || []);
      }
      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value.data.data?.categories || []);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      window.clearTimeout(visualTimeout);
    };
  }, []);

  const categoryItems = useMemo(() => {
    if (categories.length > 0) {
      return categories.slice(0, 6).map((category) => ({
        id: category.id,
        label: category.name,
        href: `/es-CL/products?category_id=${category.id}`,
      }));
    }
    return fallbackCategories.map((label, index) => ({
      id: index,
      label,
      href: '/es-CL/products',
    }));
  }, [categories]);

  const heroProduct = products[0];

  return (
    <div className="min-h-screen overflow-hidden bg-[#fbfaf7] text-[#1c2733]">
      <a
        href="#demo-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        Ir al contenido
      </a>

      <div className="bg-[#173f67] px-4 py-2 text-center text-[11px] font-semibold tracking-[0.02em] text-white sm:text-xs">
        Despacho gratis en compras sobre $39.990 · Compra segura y soporte real
      </div>

      <header className="relative z-50 border-b border-[#173f67]/10 bg-[#fbfaf7]/95 backdrop-blur-xl lg:sticky lg:top-0">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-[68px] items-center justify-between gap-3 lg:h-[76px]">
            <Link href="/storefront-demo" className="flex shrink-0 items-center gap-2.5" aria-label="Plexoria inicio">
              <BrandMark />
              <span className="text-[19px] font-black tracking-[-0.04em] text-[#173f67] sm:text-[21px]">PLEXORIA</span>
            </Link>

            <nav className="hidden items-center gap-5 xl:flex" aria-label="Navegación principal">
              <Link href="/es-CL/products" className="text-sm font-semibold text-[#425466] transition-colors hover:text-[#1677b8]">Productos</Link>
              <Link href="/es-CL/categories" className="text-sm font-semibold text-[#425466] transition-colors hover:text-[#1677b8]">Categorías</Link>
              <a href="#ofertas" className="text-sm font-semibold text-[#425466] transition-colors hover:text-[#1677b8]">Ofertas</a>
            </nav>

            <form action="/es-CL/products/search" className="ml-auto hidden min-w-0 flex-1 lg:block lg:max-w-[330px] xl:max-w-[370px]">
              <label htmlFor="demo-search-desktop" className="sr-only">Buscar productos</label>
              <div className="flex h-11 items-center gap-2.5 rounded-full bg-[#edf2f4] px-4 ring-[#1677b8]/20 transition focus-within:bg-white focus-within:ring-4">
                <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[#687784]" />
                <input
                  id="demo-search-desktop"
                  name="q"
                  type="search"
                  placeholder="¿Qué necesitas conectar?"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#1c2733] outline-none placeholder:text-[#74818c]"
                />
              </div>
            </form>

            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/es-CL/products/search"
                className="hidden h-11 w-11 items-center justify-center rounded-full text-[#273746] transition-colors hover:bg-[#edf3f6] sm:flex lg:hidden"
                aria-label="Buscar"
              >
                <SearchIcon />
              </Link>
              <Link
                href="/es-CL/profile"
                className="hidden h-11 w-11 items-center justify-center rounded-full text-[#273746] transition-colors hover:bg-[#edf3f6] sm:flex"
                aria-label="Mi cuenta"
              >
                <UserIcon />
              </Link>
              <Link
                href="/es-CL/cart"
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#273746] transition-colors hover:bg-[#edf3f6]"
                aria-label="Carrito"
              >
                <BagIcon />
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f2694b] px-1 text-[10px] font-bold text-white">2</span>
              </Link>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#273746] transition-colors hover:bg-[#edf3f6] lg:hidden"
                aria-label="Abrir menú"
              >
                <MenuIcon />
              </button>
            </div>
          </div>

          <form action="/es-CL/products/search" className="pb-3 lg:hidden">
            <label htmlFor="demo-search" className="sr-only">Buscar productos</label>
            <div className="flex h-11 items-center gap-2.5 rounded-full bg-[#edf2f4] px-4 ring-[#1677b8]/20 transition focus-within:bg-white focus-within:ring-4">
              <SearchIcon className="h-[18px] w-[18px] shrink-0 text-[#687784]" />
              <input
                id="demo-search"
                name="q"
                type="search"
                placeholder="¿Qué necesitas conectar?"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#1c2733] outline-none placeholder:text-[#74818c]"
              />
            </div>
          </form>
        </div>
      </header>

      <main id="demo-content">
        <section className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[26px] bg-[#dff1f5] px-5 pb-6 pt-9 sm:rounded-[32px] sm:px-10 sm:py-12 lg:grid lg:min-h-[500px] lg:grid-cols-[0.93fr_1.07fr] lg:items-center lg:px-16 lg:py-14">
            <div className="pointer-events-none absolute -left-16 top-16 h-44 w-44 rounded-full bg-white/45 blur-2xl" />
            <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full bg-[#9dd9df]/45 blur-3xl" />

            <div className="relative z-10 max-w-[550px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-[#17658a] shadow-sm shadow-[#17658a]/5">
                <span className="h-2 w-2 rounded-full bg-[#f2694b]" />
                Tecnología útil, sin pagar de más
              </span>
              <h1 className="mt-5 max-w-[520px] text-[36px] font-black leading-[1.04] tracking-[-0.045em] text-[#173f67] sm:text-5xl lg:text-[58px]">
                Conecta todo.<br />Complica nada.
              </h1>
              <p className="mt-4 max-w-[490px] text-[15px] leading-6 text-[#455d6f] sm:text-lg sm:leading-7">
                Accesorios confiables para tu computador, celular y espacio de trabajo. Precios claros y ayuda para elegir lo compatible.
              </p>
              <div className="mt-6 flex flex-col gap-3 min-[390px]:flex-row sm:mt-8">
                <Link
                  href="/es-CL/products"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#173f67] px-6 text-sm font-bold text-white shadow-lg shadow-[#173f67]/15 transition hover:-translate-y-0.5 hover:bg-[#0f3151]"
                >
                  Ver productos <ArrowRightIcon />
                </Link>
                <a
                  href="#categorias"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/80 px-6 text-sm font-bold text-[#173f67] transition hover:bg-white"
                >
                  Comprar por categoría
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[#4f6877] sm:mt-8">
                <span className="inline-flex items-center gap-1.5"><CheckIcon /> Pago seguro</span>
                <span className="inline-flex items-center gap-1.5"><CheckIcon /> Garantía real</span>
                <span className="inline-flex items-center gap-1.5"><CheckIcon /> Soporte cercano</span>
              </div>
            </div>

            <HeroVisual product={heroProduct} loading={loading} />
          </div>
        </section>

        <section id="categorias" className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <SectionHeading
            eyebrow="Encuentra rápido"
            title="¿Qué estás buscando?"
            action={<Link href="/es-CL/categories">Ver todas <ArrowRightIcon /></Link>}
          />
          <div className="-mx-4 mt-6 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {categoryItems.map((category, index) => (
              <Link
                key={category.id}
                href={category.href}
                className="group flex min-h-[142px] min-w-[138px] snap-start flex-col justify-between rounded-[20px] bg-white p-4 shadow-[0_2px_18px_rgba(21,48,66,0.05)] transition hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(21,48,66,0.10)] sm:min-w-0"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${index % 3 === 0 ? 'bg-[#e8f4fb] text-[#1677b8]' : index % 3 === 1 ? 'bg-[#fff0e9] text-[#df6043]' : 'bg-[#e8f4ef] text-[#25806b]'}`}>
                  {categoryIcons[index % categoryIcons.length]}
                </span>
                <span className="mt-5 text-sm font-bold leading-snug text-[#273746] group-hover:text-[#1677b8]">{category.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section id="ofertas" className="bg-white py-12 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <SectionHeading
              eyebrow="Precios que convienen"
              title="Buenas compras para esta semana"
              description="Productos útiles, elegidos por su relación entre precio y calidad."
              action={<Link href="/es-CL/products">Ver todo <ArrowRightIcon /></Link>}
            />
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {loading
                ? Array.from({ length: 5 }).map((_, index) => <ProductSkeleton key={index} />)
                : products.length > 0
                  ? products.slice(0, 5).map((product, index) => <DemoProductCard key={product.id} product={product} featured={index === 0} />)
                  : Array.from({ length: 5 }).map((_, index) => <FallbackProductCard key={index} index={index} />)}
            </div>
          </div>
        </section>

        <section id="ayuda" className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="overflow-hidden rounded-[26px] bg-[#173f67] text-white sm:rounded-[32px] lg:grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="px-6 py-9 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#80d4dc]">Estamos para ayudarte</span>
              <h2 className="mt-3 max-w-[540px] text-3xl font-black leading-tight tracking-[-0.035em] sm:text-4xl">
                ¿No sabes qué cable, cargador o adaptador necesitas?
              </h2>
              <p className="mt-4 max-w-[560px] text-sm leading-6 text-white/72 sm:text-base sm:leading-7">
                Cuéntanos qué equipo tienes y qué quieres conectar. Te ayudamos a encontrar una opción compatible, sin tecnicismos innecesarios.
              </p>
              <Link
                href="/es-CL/contact"
                className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#f2694b] px-6 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#e45c40]"
              >
                Pedir orientación <ArrowRightIcon />
              </Link>
            </div>
            <div className="relative min-h-[230px] overflow-hidden bg-[#20517c] sm:min-h-[280px] lg:min-h-full">
              <div className="absolute left-[12%] top-[18%] h-52 w-52 rounded-full bg-[#2d6e99]" />
              <div className="absolute right-[8%] top-[12%] h-40 w-40 rounded-full bg-[#80d4dc]/30 blur-xl" />
              <div className="absolute left-1/2 top-1/2 w-[76%] max-w-[350px] -translate-x-1/2 -translate-y-1/2 rotate-[-4deg] rounded-[22px] bg-white p-4 shadow-2xl shadow-black/20">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dff1f5] text-[#17658a]"><ChatIcon /></span>
                  <div>
                    <p className="text-xs font-semibold text-[#7b8993]">Soporte PLEXORIA</p>
                    <p className="mt-0.5 text-sm font-bold text-[#253746]">¡Hola! ¿Qué equipo tienes?</p>
                  </div>
                </div>
                <div className="mt-4 ml-10 rounded-2xl rounded-tr-sm bg-[#eaf4f7] px-4 py-3 text-xs leading-5 text-[#435968]">
                  Te ayudamos a revisar el puerto, potencia y compatibilidad antes de comprar.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#173f67]/10 bg-[#f4f1ea]">
          <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-y-7 px-4 py-9 sm:px-6 lg:grid-cols-4 lg:px-8 lg:py-10">
            <TrustItem icon={<TruckIcon />} title="Despacho a todo Chile" text="Seguimiento de tu pedido" />
            <TrustItem icon={<ShieldIcon />} title="Compra protegida" text="Pago y datos seguros" />
            <TrustItem icon={<ReturnIcon />} title="Cambios simples" text="Te orientamos en el proceso" />
            <TrustItem icon={<ChatIcon />} title="Soporte cercano" text="Hablamos en simple" />
          </div>
        </section>
      </main>

      <footer className="bg-[#132f4b] text-white">
        <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="flex flex-col gap-8 border-b border-white/12 pb-9 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <BrandMark inverse />
                <span className="text-xl font-black tracking-[-0.04em]">PLEXORIA</span>
              </div>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/65">Tecnología útil, precios claros y ayuda cuando la necesitas.</p>
            </div>
            <Link href="/es-CL/products" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold transition hover:bg-white/15">
              Explorar productos <ArrowRightIcon />
            </Link>
          </div>
          <div className="flex flex-col gap-3 pt-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 PLEXORIA. Demo de propuesta visual.</p>
            <div className="flex gap-5"><Link href="/es-CL/help/shipping">Despachos</Link><Link href="/es-CL/help/returns">Devoluciones</Link><Link href="/es-CL/contact">Contacto</Link></div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#1677b8]">{eyebrow}</p>
        <h2 className="mt-1.5 text-[26px] font-black leading-tight tracking-[-0.035em] text-[#1d3040] sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 hidden text-sm text-[#667581] sm:block">{description}</p>}
      </div>
      <div className="shrink-0 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a]:text-xs [&_a]:font-bold [&_a]:text-[#176b98] sm:[&_a]:text-sm">{action}</div>
    </div>
  );
}

function HeroVisual({ product, loading }: { product?: Product; loading: boolean }) {
  const image = product ? getProductPrimaryImage(product) : undefined;

  return (
    <div className="relative mt-10 min-h-[285px] lg:mt-0 lg:min-h-[410px]">
      <div className="absolute left-[5%] top-[8%] h-48 w-48 rounded-full bg-white/70 sm:left-[18%] sm:h-60 sm:w-60 lg:left-[12%] lg:top-[16%] lg:h-72 lg:w-72" />
      <div className="absolute bottom-[3%] left-1/2 h-[34px] w-[76%] -translate-x-1/2 rounded-[100%] bg-[#2c6f87]/15 blur-xl" />
      <div className="absolute left-1/2 top-1/2 aspect-[5/4] w-[72%] max-w-[340px] -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] overflow-hidden rounded-[28px] bg-[#f9faf8] p-5 shadow-[0_24px_60px_rgba(24,75,91,0.18)] sm:max-w-[390px] lg:w-[68%]">
        <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-gradient-to-br from-[#edf2f2] to-[#d8e5e8]">
          {loading ? (
            <div className="h-full w-full animate-pulse bg-white/40" />
          ) : image && product ? (
            <ImageFallback src={image} alt={product.name} fill priority className="object-contain p-5" sizes="(max-width: 1024px) 70vw, 32vw" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-[#17658a]">
              <CableIcon className="h-20 w-20" />
              <span className="mt-3 text-sm font-bold">Accesorios que sí conectan</span>
            </div>
          )}
        </div>
      </div>
      <div className="absolute right-[2%] top-[7%] rotate-[5deg] rounded-2xl bg-white px-3 py-2.5 shadow-lg shadow-[#335b6c]/10 sm:right-[11%] lg:right-[2%] lg:top-[12%]">
        <p className="text-[10px] font-semibold text-[#72818b]">Desde</p>
        <p className="text-sm font-black text-[#173f67]">{product ? formatPrice(getProductPrice(product) ?? 9990) : '$9.990'}</p>
      </div>
      <div className="absolute bottom-[7%] left-[1%] -rotate-[4deg] rounded-2xl bg-[#f2694b] px-3.5 py-2.5 text-white shadow-lg shadow-[#f2694b]/20 sm:left-[12%] lg:bottom-[11%] lg:left-[3%]">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">Compra tranquila</p>
        <p className="mt-0.5 text-xs font-black">Compatibilidad clara ✓</p>
      </div>
    </div>
  );
}

function DemoProductCard({ product, featured }: { product: Product; featured?: boolean }) {
  const image = getProductPrimaryImage(product) || '/placeholder-product.svg';
  const price = getProductPrice(product);

  return (
    <Link href={`/es-CL/products/${product.id}`} className="group min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-[18px] bg-[#f2f4f2] sm:rounded-[22px]">
        {featured && <span className="absolute left-2.5 top-2.5 z-10 rounded-full bg-[#f2694b] px-2.5 py-1 text-[10px] font-extrabold text-white sm:left-3 sm:top-3 sm:text-[11px]">Buena compra</span>}
        <button type="button" onClick={(event) => event.preventDefault()} className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#52616c] shadow-sm transition hover:text-[#f2694b] sm:right-3 sm:top-3" aria-label={`Guardar ${product.name}`}>
          <HeartIcon />
        </button>
        <ImageFallback src={image} alt={product.name} fill className="object-contain p-4 transition duration-500 group-hover:scale-[1.06] sm:p-6" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" />
      </div>
      <div className="pt-3">
        {product.brand && <p className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-[#879199]">{product.brand}</p>}
        <h3 className="mt-1 line-clamp-2 min-h-[38px] text-[13px] font-bold leading-[19px] text-[#263845] transition-colors group-hover:text-[#1677b8] sm:text-sm">{product.name}</h3>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-base font-black tracking-[-0.025em] text-[#173f67] sm:text-lg">{price !== null ? formatPrice(price) : 'Consultar'}</span>
          {featured && price !== null && <span className="text-[11px] text-[#8a949b] line-through">{formatPrice(Math.ceil(price * 1.18 / 10) * 10)}</span>}
        </div>
        <p className="mt-1 text-[11px] font-medium text-[#25806b]">Disponible · Despacho rápido</p>
      </div>
    </Link>
  );
}

function FallbackProductCard({ index }: { index: number }) {
  const names = ['Hub USB-C multipuerto', 'Cargador rápido 30W', 'Mouse inalámbrico', 'Cable HDMI 2 metros', 'Adaptador USB-C a HDMI'];
  const prices = [19990, 14990, 12990, 7990, 16990];
  return (
    <Link href="/es-CL/products" className="group min-w-0">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[18px] bg-[#f2f4f2] text-[#80a4b2] sm:rounded-[22px]">
        <span className="absolute left-2.5 top-2.5 rounded-full bg-[#f2694b] px-2.5 py-1 text-[10px] font-extrabold text-white">Recomendado</span>
        <span className="[&_svg]:h-16 [&_svg]:w-16">{categoryIcons[index % categoryIcons.length]}</span>
      </div>
      <div className="pt-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#879199]">PLEXORIA SELECT</p>
        <h3 className="mt-1 min-h-[38px] text-[13px] font-bold leading-[19px] text-[#263845] sm:text-sm">{names[index]}</h3>
        <p className="mt-2 text-base font-black text-[#173f67] sm:text-lg">{formatPrice(prices[index])}</p>
        <p className="mt-1 text-[11px] font-medium text-[#25806b]">Disponible · Despacho rápido</p>
      </div>
    </Link>
  );
}

function ProductSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square rounded-[18px] bg-[#edf0ee] sm:rounded-[22px]" />
      <div className="mt-3 h-3 w-1/3 rounded bg-[#edf0ee]" />
      <div className="mt-2 h-4 w-full rounded bg-[#edf0ee]" />
      <div className="mt-2 h-5 w-1/2 rounded bg-[#edf0ee]" />
    </div>
  );
}

function TrustItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 px-2 sm:px-4 lg:border-r lg:border-[#173f67]/10 lg:last:border-r-0">
      <span className="mt-0.5 text-[#1677b8] [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
      <div><p className="text-xs font-extrabold text-[#263845] sm:text-sm">{title}</p><p className="mt-1 hidden text-xs text-[#6e7b84] sm:block">{text}</p></div>
    </div>
  );
}

function getProductPrice(product: Product): number | null {
  const prices = (product.skus || []).filter((sku) => sku.is_active).map((sku) => Number(sku.price)).filter(Number.isFinite);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
}

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[12px] ${inverse ? 'bg-white text-[#173f67]' : 'bg-[#173f67] text-white'}`}>
      <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-[#80d4dc]" />
      <BoltIcon className="relative h-[19px] w-[19px]" />
    </span>
  );
}

type IconProps = { className?: string };

function SearchIcon({ className = 'h-5 w-5' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4" strokeLinecap="round"/></svg>; }
function UserIcon({ className = 'h-[21px] w-[21px]' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="8" r="3.3"/><path d="M5.8 20c.5-4 2.7-6 6.2-6s5.7 2 6.2 6" strokeLinecap="round"/></svg>; }
function BagIcon({ className = 'h-[22px] w-[22px]' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 8.5h14l-1 11H6l-1-11Z" strokeLinejoin="round"/><path d="M9 9V6a3 3 0 0 1 6 0v3" strokeLinecap="round"/></svg>; }
function MenuIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>; }
function ArrowRightIcon({ className = 'h-4 w-4' }: IconProps) { return <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12M11 5l5 5-5 5"/></svg>; }
function CheckIcon({ className = 'h-4 w-4' }: IconProps) { return <svg className={className} viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".12"/><path d="m6.5 10 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function HeartIcon({ className = 'h-[18px] w-[18px]' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20.8 5.8c-2.3-2.3-5.8-1.5-7.2.8L12 9l-1.6-2.4C9 4.3 5.5 3.5 3.2 5.8.6 8.4 2 13.1 12 20c10-6.9 11.4-11.6 8.8-14.2Z" strokeLinejoin="round"/></svg>; }
function BoltIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m13.5 2-8 12h6l-1 8 8-12h-6l1-8Z"/></svg>; }
function CableIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v6M4 3v3h6V3M7 9v2a6 6 0 0 0 6 6h1M17 21v-6M14 21v-3h6v3"/></svg>; }
function MouseIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 3v6M9 9h6"/></svg>; }
function StorageIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M7.5 15h9M8 9h.01M12 9h4" strokeLinecap="round"/></svg>; }
function WifiIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9a12 12 0 0 1 16 0M7 12.5a7.5 7.5 0 0 1 10 0M10 16a3 3 0 0 1 4 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></svg>; }
function HeadphonesIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><path d="M7 12H5.5A1.5 1.5 0 0 0 4 13.5v4A1.5 1.5 0 0 0 5.5 19H7v-7ZM17 12h1.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H17v-7Z"/></svg>; }
function ChatIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>; }
function TruckIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h11v12H3zM14 9h4l3 4v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>; }
function ShieldIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4.5 6v5.5c0 4.8 3 8 7.5 9.5 4.5-1.5 7.5-4.7 7.5-9.5V6L12 3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>; }
function ReturnIcon({ className = 'h-6 w-6' }: IconProps) { return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a8 8 0 1 1 2.3 7.5"/><path d="M4 5v5h5"/></svg>; }
