'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CategoryIcon } from '@/components/category/CategoryIcon';
import { buildPublicCategoryTree } from '@/lib/category-tree';
import { HOME_CATEGORY_LIMIT } from '@/lib/home';
import type { Category } from '@/types';
import styles from './CategoryRail.module.css';

export default function CategoryRail({ categories }: { categories: Category[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const items = useMemo(() => {
    const roots = buildPublicCategoryTree(categories);
    // Reserve the last card for the complete directory.
    return roots.length > 0 ? [...roots.slice(0, HOME_CATEGORY_LIMIT - 1), null] : [];
  }, [categories]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const anchorIndex = useRef(0);
  const [layout, setLayout] = useState({ paged: false, columns: 3 });
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = layout.columns * 2;
  const pages = useMemo(() => {
    if (!layout.paged) return [items];
    return Array.from({ length: Math.ceil(items.length / pageSize) }, (_, index) => items.slice(index * pageSize, (index + 1) * pageSize));
  }, [items, layout.paged, pageSize]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const touchLayout = window.matchMedia('(max-width: 1023px) and (pointer: coarse)');
    const update = () => {
      const width = viewport.clientWidth;
      // Phones use three columns so full category names have room to wrap.
      const columns = width >= 576 ? 6 : 3;
      setLayout(previous => previous.paged === touchLayout.matches && previous.columns === columns
        ? previous : { paged: touchLayout.matches, columns });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    touchLayout.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      touchLayout.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const page = layout.paged ? Math.min(Math.floor(anchorIndex.current / pageSize), Math.max(pages.length - 1, 0)) : 0;
    setCurrentPage(page);
    const frame = requestAnimationFrame(() => viewport.scrollTo({ left: page * viewport.clientWidth, behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [layout, pageSize, pages.length]);

  const goToPage = (page: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    anchorIndex.current = page * pageSize;
    viewport.scrollTo({ left: page * viewport.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return (
    <section id="categories" className={styles.section} aria-label={t('home.categoriesTitle')}>
      <div
        ref={viewportRef}
        className={`${styles.viewport} ${layout.paged ? styles.paged : ''}`}
        style={{ '--category-columns': layout.columns } as CSSProperties}
        onScroll={event => {
          if (!layout.paged) return;
          const page = Math.min(Math.max(pages.length - 1, 0), Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth));
          anchorIndex.current = page * pageSize;
          setCurrentPage(page);
        }}
      >
        {pages.map((page, pageIndex) => (
          <div key={pageIndex} className={styles.page}>
            {page.map((category, categoryIndex) => (
              <Link
                key={category?.id ?? 'all-categories'}
                href={category ? `/${locale}/products?category_id=${category.id}` : `/${locale}/categories`}
                className={styles.item}
                onFocus={() => {
                  anchorIndex.current = pageIndex * pageSize + categoryIndex;
                  if (layout.paged && pageIndex !== currentPage) goToPage(pageIndex);
                }}
              >
                <CategoryIcon imageUrl={category?.image_asset?.url} iconKey={category?.icon_key ?? 'general'} label={category?.name ?? t('home.allCategories')} className={styles.icon} />
                <span className={styles.label}>{category?.name ?? t('home.allCategories')}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      {layout.paged && pages.length > 1 && (
        <nav className={styles.pagination} aria-label={t('home.categoryPagination')}>
          {pages.map((_, index) => (
            <button key={index} type="button" className={styles.pageButton} onClick={() => goToPage(index)} aria-label={t('home.categoryPage', { page: index + 1, total: pages.length })} aria-current={currentPage === index ? 'page' : undefined}>
              <span className={`${styles.dot} ${currentPage === index ? styles.activeDot : ''}`} />
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
