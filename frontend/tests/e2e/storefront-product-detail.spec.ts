import { expect, test } from '@playwright/test';

const blueImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22blue%22/%3E%3C/svg%3E';
const redImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%2210%22%3E%3Crect width=%2210%22 height=%2210%22 fill=%22red%22/%3E%3C/svg%3E';

const product = {
  id: 22,
  name: 'Configurable USB-C Hub',
  description: 'A useful hub for everyday connections.',
  specifications: '{}',
  status: 'published',
  is_active: true,
  created_at: '2026-07-30T09:00:00Z',
  updated_at: '2026-07-30T09:00:00Z',
  images: [{ id: 1, product_id: 22, image_url: '/placeholder-product.svg', sort_order: 0, is_primary: true }],
  skus: [
    {
      id: 220, product_id: 22, sku_code: 'HUB-BLUE', price: 15990, inventory: 3,
      image_url: blueImage, is_active: true,
      attributes: [{ id: 1, sku_id: 220, name: 'Color', value: 'Blue' }],
    },
    {
      id: 221, product_id: 22, sku_code: 'HUB-RED', price: 21990, inventory: 0,
      image_url: redImage, is_active: true,
      attributes: [{ id: 2, sku_id: 221, name: 'Color', value: 'Red' }],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('http://localhost:8080/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/products/22' || url.pathname === '/api/v1/admin/products/22/preview') {
      await route.fulfill({ json: { data: product } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
});

test('SKU selection updates price, stock, image and purchase state', async ({ page }) => {
  await page.goto('/en/products/22');
  const addButton = page.getByRole('button', { name: 'Add to cart' }).first();
  const buyButton = page.getByRole('button', { name: 'Buy now' }).first();
  await expect(page.getByRole('radio', { name: 'Blue' })).toBeChecked();
  await expect(page.getByText('CLP 15,990').first()).toBeVisible();
  await expect(page.getByText('Available (3 in stock)')).toBeVisible();
  await expect(page.locator('img[alt="Configurable USB-C Hub"]').first()).toHaveAttribute('src', blueImage);
  await expect(addButton).toBeEnabled();
  await expect(buyButton).toBeEnabled();

  await page.getByRole('radio', { name: /Red/ }).click();
  await expect(page.getByText('CLP 21,990').first()).toBeVisible();
  await expect(page.getByText('Sold out').first()).toBeVisible();
  await expect(page.locator('img[alt="Configurable USB-C Hub"]').first()).toHaveAttribute('src', redImage);
  await expect(addButton).toBeDisabled();
  await expect(buyButton).toBeDisabled();
});

test('product image shows an original-size zoom preview on hover', async ({ page }) => {
  await page.goto('/en/products/22');
  const zoomButton = page.getByRole('button', { name: 'Zoom image to original size' });
  const zoomPreview = page.getByTestId('product-image-zoom');

  await expect(zoomButton).toBeVisible();
  await expect(zoomButton).toHaveAttribute('aria-pressed', 'false');
  await expect(zoomPreview).toHaveCSS('background-size', 'auto');

  await zoomButton.hover({ position: { x: 60, y: 90 } });
  await expect(zoomButton).toHaveAttribute('aria-pressed', 'true');
  await expect(zoomPreview).toHaveClass(/opacity-100/);

  await page.mouse.move(380, 830);
  await expect(zoomButton).toHaveAttribute('aria-pressed', 'false');
});

test('gallery edge arrows switch images in both directions', async ({ page }) => {
  await page.goto('/en/products/22');
  const thumbnails = page.getByRole('option');

  await expect(thumbnails.nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'View next image' }).click();
  await expect(thumbnails.nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'View previous image' }).click();
  await expect(thumbnails.nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'View previous image' }).click();
  await expect(thumbnails.nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('adding to cart stays on the product, updates the header and restores focus', async ({ page }) => {
  await page.goto('/en/products/22');
  await page.getByRole('radio', { name: 'Blue' }).click();
  const addButton = page.getByRole('button', { name: 'Add to cart' }).first();
  await addButton.click();

  await expect(page).toHaveURL(/\/en\/products\/22$/);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Added to cart')).toBeVisible();
  await expect(dialog.getByText('Configurable USB-C Hub')).toBeVisible();
  await expect(page.getByRole('link', { name: /1 items in cart/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue shopping' }).click();
  await expect(dialog).toBeHidden();
  await expect(addButton).toBeFocused();
  await expect(page).toHaveURL(/\/en\/products\/22$/);
  await expect(page.getByRole('heading', { name: 'Configurable USB-C Hub' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const center = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    return Boolean(center?.closest('.ant-drawer'));
  })).toBe(false);
});

test('insufficient remaining stock reports an error without opening the mini cart', async ({ page }) => {
  await page.addInitScript((existingProduct) => {
    const sku = existingProduct.skus[0];
    localStorage.setItem('cart-storage', JSON.stringify({ state: {
      items: [{ id: 1, sku_id: sku.id, sku, quantity: 3, unit_price: sku.price, subtotal: sku.price * 3 }],
      totalPrice: sku.price * 3,
      totalItems: 3,
    }, version: 0 }));
  }, product);

  await page.goto('/en/products/22');
  await page.getByRole('radio', { name: 'Blue' }).click();
  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByText('Total quantity exceeds available stock. Available: 3')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/en\/products\/22$/);
});

test('sold-out products and preview mode keep purchase actions disabled', async ({ page }) => {
  await page.goto('/en/products/22');
  await page.getByRole('radio', { name: /Red/ }).click();
  await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Buy now' }).first()).toBeDisabled();

  await page.goto('/en/products/22?preview_token=test-preview');
  await expect(page.getByText('Purchases are disabled in preview mode.')).toBeVisible();
  await page.getByRole('radio', { name: 'Blue' }).click();
  await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Buy now' }).first()).toBeDisabled();
});
