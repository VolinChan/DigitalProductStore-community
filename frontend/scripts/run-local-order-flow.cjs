const { chromium } = require('playwright');
const { expect } = require('@playwright/test');

const baseURL = process.env.PLEXORIA_LOCAL_URL || 'http://localhost:8080';
const purchaseEmail = `qa.checkout.${Date.now()}@example.com`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const failedResponses = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  await page.addInitScript(() => localStorage.setItem('plexoria-cookie-consent:v1', JSON.stringify({
    policy_version: '0.1-draft', locale: 'es-CL', recorded_at: new Date().toISOString(),
    necessary: true, analytics: false, marketing: false, personalization: false,
  })));

  try {
    await page.goto(`${baseURL}/es-CL/products/test1`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'test122222', level: 1 })).toBeVisible();
    await expect(page.getByText('SKU: s001111', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Agregar al carrito/ }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toContainText('test122222');
    await expect(drawer).toContainText('s001111');
    await drawer.getByRole('link', { name: /Ver carrito/ }).click();

    await expect(page).toHaveURL(/\/es-CL\/cart$/);
    await expect(page.getByRole('heading', { name: 'test122222', exact: true })).toBeVisible();
    await expect(page.getByText('s001111', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Finalizar compra', exact: true }).click();

    await expect(page).toHaveURL(/\/es-CL\/checkout\?mode=cart$/);
    await page.getByLabel('Nombre completo').fill('Cliente QA Plexoria');
    await page.getByLabel('Correo electrónico').fill(purchaseEmail);
    await page.getByLabel('Teléfono de contacto').fill('+56 9 9509 6835');
    const regionSelect = page.getByRole('combobox', { name: 'Región', exact: true });
    await regionSelect.click();
    await regionSelect.press('ArrowDown');
    await regionSelect.press('Enter');
    const communeSelect = page.getByRole('combobox', { name: 'Comuna', exact: true });
    await expect(communeSelect).toBeEnabled();
    await communeSelect.click();
    await communeSelect.press('ArrowDown');
    await communeSelect.press('Enter');
    await page.getByLabel('Calle').fill('Alameda QA');
    await page.getByLabel('Número').fill('2963');
    await page.getByLabel('Departamento o complemento (opcional)').fill('Prueba E2E');
    await page.getByLabel('Referencia de entrega (opcional)').fill('NO DESPACHAR - PEDIDO QA');

    await expect(page.getByText('Despacho base').locator('..')).toBeVisible();
    await expect(page.getByText('Subsidio de despacho').locator('..')).toBeVisible();
    await expect(page.getByText('Costo de despacho').locator('..')).toContainText('Gratis');
    await expect(page.getByText('Transferencia bancaria', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: /Acepto los términos y condiciones/ }).check();

    const orderResponsePromise = page.waitForResponse((response) => response.url().endsWith('/api/v1/orders') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Enviar pedido', exact: true }).click();
    const orderResponse = await orderResponsePromise;
    const orderBody = await orderResponse.json();
    if (orderResponse.status() !== 201) throw new Error(`order creation returned ${orderResponse.status()}: ${JSON.stringify(orderBody)}`);
    const order = orderBody.data;

    await expect(page).toHaveURL(new RegExp(`/es-CL/checkout/payment\\?.*order_id=${order.id}`));
    await expect(page.getByText(order.order_number, { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Banco de Prueba (solo QA)', { exact: true })).toBeVisible();
    await expect(page.locator('#main-content').getByText('Plexoria SpA', { exact: true })).toBeVisible();
    await expect(page.locator('#main-content').getByText(new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(order.total_amount)), { exact: true }).last()).toBeVisible();

    await page.getByRole('button', { name: 'Ya hice la transferencia', exact: true }).click();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: `qa-${order.order_number}.pdf`, mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'),
    });
    await page.getByRole('button', { name: /Enviar comprobante/ }).click();
    await expect(page.getByRole('status')).toContainText('Comprobante subido');

    await page.locator('#main-content').getByRole('link', { name: 'Seguimiento de pedido', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/es-CL/orders/track\\?order_number=${encodeURIComponent(order.order_number)}`));
    await expect(page.getByLabel('Número de pedido')).toHaveValue(order.order_number);
    await page.getByLabel('Correo de compra').fill(purchaseEmail);
    await page.getByRole('button', { name: /Consultar pedido/ }).click();
    await expect(page.getByText(order.order_number, { exact: true }).last()).toBeVisible();
    const trackedItem = page.getByText('test122222', { exact: true }).last().locator('..');
    await expect(trackedItem).toBeVisible();
    await expect(trackedItem).not.toContainText('{');
    await expect(page.getByText('Comprobante en revisión', { exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/plexoria-live-order-flow-success.png', fullPage: true });

    process.stdout.write(`${JSON.stringify({
      order_id: order.id,
      order_number: order.order_number,
      purchase_email: purchaseEmail,
      subtotal: 11111,
      shipping_base: Number(order.shipping_base_amount),
      shipping_subsidy: Number(order.shipping_subsidy_amount),
      shipping_payable: Number(order.shipping_payable_amount),
      total: Number(order.total_amount),
      status: 'pending_transfer',
      failed_responses: failedResponses,
    }, null, 2)}\n`);
  } catch (error) {
    await page.screenshot({ path: '/tmp/plexoria-live-order-flow-failure.png', fullPage: true }).catch(() => undefined);
    if (failedResponses.length > 0) process.stderr.write(`Failed responses:\n${failedResponses.join('\n')}\n`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
