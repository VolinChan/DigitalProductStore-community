import { chromium, expect, test, type Page } from '@playwright/test';
import { seedNecessaryCookieConsent } from './helpers/shipping';

const product = {
  id: 28, slug: 'video-lamp', name: 'Video lamp', description: 'A lamp with a video.', specifications: '{}',
  status: 'published', is_active: true, created_at: '2026-10-09T00:00:00Z', updated_at: '2026-10-09T00:00:00Z',
  images: [],
  media: [
    { id: 1, media_asset_id: 1, sort_order: 0, is_primary: true, media_asset: { id: 1, kind: 'image', url: '/placeholder-product.svg', mime_type: 'image/svg+xml' } },
    { id: 2, media_asset_id: 2, sort_order: 1, is_primary: false, media_asset: { id: 2, kind: 'image', url: '/placeholder-product.svg', mime_type: 'image/svg+xml' } },
    { id: 3, media_asset_id: 3, sort_order: 8, is_primary: false, media_asset: { id: 3, kind: 'video', url: '/uploads/preview.webm', mime_type: 'video/webm' } },
  ],
  skus: [{ id: 67, product_id: 28, sku_code: 'LAMP-67', price: 15990, inventory: 4, attributes: [], is_active: true }],
};

let videoBytes: Buffer;
test.beforeAll(async ({ browser }) => {
  // WebKit can decode WebM but does not expose MediaRecorder in this runner.
  // Generate the same real video in Chromium; playback is still tested by the
  // selected project's browser, without mocking play() in the success cases.
  const recorderBrowser = browser.browserType().name() === 'chromium' ? browser : await chromium.launch();
  const page = await recorderBrowser.newPage();
  // Generate a tiny real, decodable video; no binary asset or dependency is added.
  videoBytes = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const done = new Promise<number[]>((resolve) => { recorder.onstop = async () => resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))); });
    recorder.start();
    let frame = 0;
    const timer = setInterval(() => { context.fillStyle = frame++ % 2 ? '#173f67' : '#dbe9eb'; context.fillRect(0, 0, 64, 64); }, 70);
    await new Promise((resolve) => setTimeout(resolve, 850));
    clearInterval(timer); recorder.stop(); stream.getTracks().forEach((track) => track.stop());
    return done;
  }));
  await page.close();
  if (recorderBrowser !== browser) await recorderBrowser.close();
});

async function setup(page: Page, item = product) {
  await seedNecessaryCookieConsent(page);
  await page.route('**/placeholder-product.svg', (route) => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#dbe9eb"/></svg>' }));
  await page.route('**/uploads/preview.webm', (route) => route.fulfill({ contentType: 'video/webm', body: videoBytes }));
  await page.route('http://localhost:8080/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/v1/products/28' ? item
      : path === '/api/v1/products' ? { products: [item], total: 1 }
        : path === '/api/v1/categories' ? { categories: [] } : {};
    return route.fulfill({ json: { data }, headers: {
      'access-control-allow-origin': route.request().headers().origin || 'http://127.0.0.1:3110',
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': route.request().headers()['access-control-request-headers'] || 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    } });
  });
}

test('detail previews muted inline over the first image and stops on pause, image change, lightbox and hidden page', async ({ page }) => {
  await setup(page);
  await page.goto('/en/products/28');
  const stage = page.getByTestId('product-gallery-stage');
  const preview = stage.getByTestId('muted-video-preview');
  await expect(preview).toHaveAttribute('data-playing', 'true');
  expect(await preview.locator('video').evaluate((element: HTMLVideoElement) => ({ muted: element.muted, inline: element.playsInline, paused: element.paused }))).toEqual({ muted: true, inline: true, paused: false });
  await expect(stage.locator('img').first()).toHaveAttribute('src', new URL('/placeholder-product.svg', page.url()).href);
  await page.getByRole('button', { name: 'Pause video', exact: true }).click();
  await expect(preview.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume video', exact: true }).click();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: 'View next image', exact: true }).click();
  await expect(stage.locator('video')).toHaveCount(0);
  await page.getByRole('button', { name: 'View previous image', exact: true }).click();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: 'Open full-screen image gallery' }).click();
  await expect(page.getByTestId('product-gallery-lightbox')).toBeVisible();
  await expect(stage.locator('video')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(stage.locator('video')).toHaveCount(0);
  await stage.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(stage.locator('video')).toHaveCount(0);
});

test('list fetches no video until hover or keyboard focus and stops when leaving', async ({ page }) => {
  await setup(page);
  let requests = 0;
  page.on('request', (request) => { if (request.url().includes('/uploads/preview.webm')) requests++; });
  await page.goto('/en/products');
  const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Video lamp' }) });
  const preview = card.getByTestId('muted-video-preview');
  await expect(card).toBeVisible();
  expect(requests).toBe(0);
  await card.hover();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.mouse.move(0, 0);
  await expect(preview.locator('video')).toHaveCount(0);
  await card.focus();
  await expect(preview).toHaveAttribute('data-playing', 'true');
  await page.keyboard.press('Tab');
  await expect(preview.locator('video')).toHaveCount(0);
});

test('autoplay rejection keeps the image and manual video entry without an unhandled error', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')); });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/en/products/28');
  const stage = page.getByTestId('product-gallery-stage');
  await expect(stage.getByTestId('muted-video-preview')).toHaveAttribute('data-playing', 'false');
  await expect(stage.locator('img').first()).toBeVisible();
  await page.getByRole('button', { name: 'Watch video' }).click();
  await expect(stage.locator('video')).toHaveAttribute('controls', '');
  expect(errors).toEqual([]);
});

for (const preference of ['reduced-motion', 'save-data']) {
  test(`${preference} disables automatic video without removing the manual entry`, async ({ page }) => {
    await setup(page);
    if (preference === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: Object.assign(new EventTarget(), { saveData: true }) }));
    await page.goto('/en/products/28');
    await expect(page.getByRole('button', { name: 'Watch video' })).toBeVisible();
    await expect(page.getByTestId('product-gallery-stage').locator('video')).toHaveCount(0);
  });
}

test('video remains available when the selected SKU has its own images', async ({ page }) => {
  const item = structuredClone(product);
  Object.assign(item.skus[0], { media: [{ id: 77, sort_order: 0, is_primary: true, media_asset: { id: 77, kind: 'image', url: '/placeholder-product.svg' } }] });
  await setup(page, item);
  await page.goto('/en/products/28');
  await expect(page.getByTestId('muted-video-preview')).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: 'Watch video' }).click();
  await expect(page.getByTestId('product-gallery-stage').locator('video')).toHaveAttribute('src', '/uploads/preview.webm');
});

test.describe('touch lists', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('keeps images without downloading videos while browsing or focusing cards', async ({ page }) => {
    await setup(page);
    let requests = 0;
    page.on('request', (request) => { if (request.url().includes('/uploads/preview.webm')) requests++; });
    await page.goto('/en/products');
    const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Video lamp' }) });
    await card.focus();
    await card.hover();
    await expect(card.locator('img')).toBeVisible();
    await expect(card.locator('video')).toHaveCount(0);
    expect(requests).toBe(0);
  });
});
