import type { Category } from '@/types';

export type CategoryNode = Omit<Category, 'children'> & { children: CategoryNode[] };

// Only branches reachable from an active root are public. Orphans, disabled
// ancestors and cycles are excluded rather than promoted into root categories.
export function buildPublicCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<number | undefined, Category[]>();
  const seen = new Set<number>();
  for (const category of categories) {
    if (category.is_active === false || seen.has(category.id)) continue;
    seen.add(category.id);
    const parent = category.parent_id || undefined;
    byParent.set(parent, [...(byParent.get(parent) || []), category]);
  }
  const visit = (parent: number | undefined, ancestors: Set<number>): CategoryNode[] => (byParent.get(parent) || [])
    .filter((category) => !ancestors.has(category.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name) || a.id - b.id)
    .map((category) => ({ ...category, children: visit(category.id, new Set([...ancestors, category.id])) }));
  return visit(undefined, new Set());
}
