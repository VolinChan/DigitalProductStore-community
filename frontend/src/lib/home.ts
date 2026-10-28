import { buildPublicCategoryTree } from '@/lib/category-tree';
import type { Category, Product } from '@/types';

export const HOME_SECTION_LIMIT = 5;
export const HOME_MIN_PRODUCTS_PER_SECTION = 3;
export const HOME_CATEGORY_LIMIT = 10;
export const HOME_COMPACT_PRODUCTS_PER_SECTION = 4;
export const HOME_PRODUCTS_PER_SECTION = 5;
export const HOME_PRODUCT_LIMIT = (HOME_SECTION_LIMIT + 1) * HOME_PRODUCTS_PER_SECTION;

export interface HomeProductSection {
  category: Category;
  products: Product[];
  total: number;
}

interface HomeCategoryQuery {
  page: number;
  pageSize: number;
  categoryId: number;
  sortBy: 'recommended';
}

// Fetch inside each public root category before limiting. Grouping a global
// first page would silently omit entire categories and older recommendations.
export async function loadHomeSections(
  categories: Category[],
  fetchProducts: (query: HomeCategoryQuery) => Promise<{ products: Product[]; total: number }>,
): Promise<HomeProductSection[]> {
  const roots = buildPublicCategoryTree(categories);
  const sections: HomeProductSection[] = [];
  const sparseSections: HomeProductSection[] = [];
  let sparseCount = 0;
  for (let offset = 0; offset < roots.length && sections.length < HOME_SECTION_LIMIT; offset += HOME_SECTION_LIMIT) {
    const batch = roots.slice(offset, offset + HOME_SECTION_LIMIT);
    const results = await Promise.all(batch.map(async category => {
      const result = await fetchProducts({ page: 1, pageSize: HOME_PRODUCTS_PER_SECTION, categoryId: category.id, sortBy: 'recommended' });
      return { category, products: result.products.slice(0, HOME_PRODUCTS_PER_SECTION), total: result.total };
    }));
    for (const section of results) {
      if (section.products.length >= HOME_MIN_PRODUCTS_PER_SECTION) {
        sections.push(section);
      } else if (section.products.length > 0 && sparseCount < HOME_PRODUCTS_PER_SECTION) {
        const products = section.products.slice(0, HOME_PRODUCTS_PER_SECTION - sparseCount);
        sparseSections.push({ ...section, products });
        sparseCount += products.length;
      }
    }
  }
  return [...sections.slice(0, HOME_SECTION_LIMIT), ...sparseSections];
}
