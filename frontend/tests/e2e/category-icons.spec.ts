import { expect, test } from '@playwright/test';

test('uses uploaded, inherited, and fallback category visuals without card overflow', async ({ page }) => {
  await page.route('http://localhost:8080/api/v1/categories', async (route) => {
    await route.fulfill({ json: { data: { categories: [
      { id: 1, name: 'Power', slug: 'power', parent_id: null, sort_order: 0, is_active: true, icon_key: 'power', image_asset: { url: '/images/placeholder-product.svg' } },
      { id: 2, name: 'Child', slug: 'child', parent_id: 1, sort_order: 1, is_active: true, icon_key: null },
      { id: 3, name: 'Unknown', slug: 'unknown', parent_id: null, sort_order: 2, is_active: true, icon_key: 'future-key' },
    ] } } });
  });

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/en/categories');
  await expect(page.getByRole('img', { name: 'Power category image' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Child category image' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Unknown category image' })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
