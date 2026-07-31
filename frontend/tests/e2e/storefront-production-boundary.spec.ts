import { expect, test } from '@playwright/test';

test('production build does not expose the storefront visual prototype', async ({ page }) => {
  const response = await page.goto('/storefront-demo');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
});
