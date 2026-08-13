import { expect, test, type Page } from '@playwright/test';

const templates = [
  {
    event_type: 'paid', locale: 'es-CL', subject_template: 'Pago confirmado{{order_suffix}}',
    html_template: '<!doctype html><html><body><h1>{{subject}}</h1><p>{{order_number}}</p></body></html>',
    variables: ['action_text', 'action_url', 'event_type', 'locale', 'order_id', 'order_number', 'order_suffix', 'subject', 'support_email', 'title'],
    is_custom: false,
  },
  {
    event_type: 'shipped', locale: 'en', subject_template: 'Your order shipped{{order_suffix}}',
    html_template: '<!doctype html><html><body><h1>{{subject}}</h1><p>{{tracking_number}}</p></body></html>',
    variables: ['order_number', 'order_suffix', 'subject', 'tracking_number'], is_custom: true,
  },
];

let savedPayload: Record<string, unknown> | undefined;

async function mockAdmin(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-token');
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'e2e-token', refreshToken: 'refresh', isAuthenticated: true }, version: 0 }));
  });
  await page.route('http://localhost:8080/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/profile') {
      await route.fulfill({ json: { data: { id: 9, email: 'admin@example.com', full_name: 'Admin', role: 'super_admin', permissions: ['manage_content'] } } });
      return;
    }
    if (path === '/api/v1/admin/email-templates' && request.method() === 'GET') {
      await route.fulfill({ json: { data: { templates } } });
      return;
    }
    if (path === '/api/v1/admin/email-templates/preview' && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, string>;
      await route.fulfill({ json: { data: { subject: body.subject_template.replace('{{order_number}}', 'ORD-2026-0042'), title: 'Pago confirmado', body_summary: '', html: '<html><body><h1>Vista previa</h1><p>ORD-2026-0042</p></body></html>', deep_link: '' } } });
      return;
    }
    if (path === '/api/v1/admin/email-templates' && request.method() === 'PUT') {
      savedPayload = request.postDataJSON() as Record<string, unknown>;
      await route.fulfill({ json: { data: { ...savedPayload, is_custom: true } } });
      return;
    }
    await route.fulfill({ json: { data: {} } });
  });
}

test('super admin previews and saves a localized email template', async ({ page }) => {
  savedPayload = undefined;
  await mockAdmin(page);
  await page.goto('/admin/email-templates');
  await expect(page.getByRole('heading', { name: '邮件模板' })).toBeVisible();
  const row = page.getByRole('row', { name: /付款确认.*Español/ });
  await row.getByRole('button', { name: '编辑' }).click();
  await page.getByLabel('邮件主题').fill('Pago recibido {{order_number}}');
  await page.getByLabel('HTML 模板').fill('<html><body><h1>{{subject}}</h1><p>{{order_number}}</p></body></html>');
  await page.getByRole('button', { name: '使用示例数据预览' }).click();
  await expect(page.getByText('Pago recibido ORD-2026-0042')).toBeVisible();
  await expect(page.frameLocator('iframe').getByText('ORD-2026-0042')).toBeVisible();
  await page.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect.poll(() => savedPayload).toEqual(expect.objectContaining({ event_type: 'paid', locale: 'es-CL', subject_template: 'Pago recibido {{order_number}}' }));
});
