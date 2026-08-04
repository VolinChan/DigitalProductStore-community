import { expect, test } from '@playwright/test';

const account = { id: 1, bank_name: 'Banco Uno', account_name: 'PLEXORIA SpA', rut: '76.123.456-7', account_type: 'Cuenta Corriente', account_number: '111222', email: 'pagos@example.com', sort_order: 0, is_active: true };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ account }) => {
    sessionStorage.setItem('transfer-accounts:91', JSON.stringify([account]));
    sessionStorage.setItem('transfer-email:91', 'buyer@example.com');
  }, { account });
});

test('submits multiple private proofs with bounded concurrency and per-file status', async ({ page, context }) => {
  let activeUploads = 0;
  let maxActiveUploads = 0;
  let uploadCount = 0;
  let submitted = false;
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/transfer-declarations' && request.method() === 'POST') {
      expect(request.postDataJSON()).toMatchObject({ order_id: 91, purchase_email: 'buyer@example.com', entries: [] });
      await route.fulfill({ status: 201, json: { data: { id: 501, order_id: 91, status: 'draft', entries: [], proofs: [], submitted_at: new Date().toISOString() } } }); return;
    }
    if (path === '/api/v1/transfer-declarations/501/proofs') {
      activeUploads += 1; maxActiveUploads = Math.max(maxActiveUploads, activeUploads);
      await new Promise((resolve) => setTimeout(resolve, 80));
      activeUploads -= 1; uploadCount += 1;
      await route.fulfill({ status: 201, json: { data: { id: uploadCount, scan_status: 'pending_scan' } } }); return;
    }
    if (path === '/api/v1/transfer-declarations/501/submit') {
      submitted = true; await route.fulfill({ json: { data: { id: 501, status: 'submitted' } } }); return;
    }
    await route.fulfill({ json: { data: {} } });
  });
  await page.goto('/en/checkout/payment?order_id=91&order_number=ORD-91&amount=12990&method=transfer');
  await page.getByRole('button', { name: 'I have transferred' }).click();
  await page.locator('input[type=file]').first().setInputFiles(Array.from({ length: 4 }, (_, index) => ({ name: `receipt-${index}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test') })));
  await expect(page.getByLabel('Proof upload queue')).toContainText('receipt-0.pdf');
  await page.getByRole('button', { name: 'Submit proof' }).click();
  await expect(page.getByText('Proof uploaded', { exact: true })).toBeVisible();
  expect(uploadCount).toBe(4);
  expect(maxActiveUploads).toBeLessThanOrEqual(3);
  expect(submitted).toBe(true);
});

test('supports the expanded transfer-entry flow on mobile', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let beginPayload: Record<string, unknown> | undefined;
  await context.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/transfer-declarations') {
      beginPayload = request.postDataJSON();
      await route.fulfill({ status: 201, json: { data: { id: 502, order_id: 91, status: 'draft', entries: [{ id: 801, declaration_id: 502 }], submitted_at: new Date().toISOString() } } }); return;
    }
    if (path.endsWith('/proofs')) { await route.fulfill({ status: 201, json: { data: { id: 901, scan_status: 'pending_scan' } } }); return; }
    if (path.endsWith('/submit')) { await route.fulfill({ json: { data: { id: 502, status: 'submitted' } } }); return; }
    await route.fulfill({ json: { data: {} } });
  });
  await page.goto('/en/checkout/payment?order_id=91&order_number=ORD-91&amount=12990&method=transfer');
  await page.getByRole('button', { name: 'I have transferred' }).click();
  await page.getByRole('button', { name: 'Using multiple accounts or making multiple transfers?' }).click();
  await page.locator('select').selectOption('1');
  await page.getByPlaceholder('Transferred amount (optional)').fill('12990');
  await page.getByPlaceholder('Note (optional)').fill('First transfer');
  await page.locator('input[type=file]').nth(2).setInputFiles({ name: 'mobile.heic', mimeType: 'image/heic', buffer: Buffer.from('0000ftypheic') });
  await page.getByRole('button', { name: 'Submit proof' }).click();
  await expect(page.getByText('Proof uploaded', { exact: true })).toBeVisible();
  expect(beginPayload).toMatchObject({ order_id: 91, entries: [{ account_id: 1, amount: '12990', note: 'First transfer' }] });
});
