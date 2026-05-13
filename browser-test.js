// Real browser smoke test: navigates to each page, waits for hydration,
// captures any client-side errors, and fails if the "Application error"
// boundary appears or expected content is missing.
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://host.docker.internal';
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  --  ' + detail : ''}`);
}

// When this test runs from a docker container inside the compose network,
// the front-end bundle has `NEXT_PUBLIC_API_BASE_URL=http://localhost`
// baked in. Inside the test container "localhost" is the container itself,
// not the host, so API calls would hit a closed port. We rewrite those
// localhost hits to the in-network nginx.
async function installLocalhostRewrite(ctx) {
  await ctx.route('http://localhost/**', async (route) => {
    const url = route.request().url();
    const rewritten = url.replace('http://localhost', 'http://nginx');
    const headers = { ...route.request().headers(), host: 'localhost' };
    try {
      const response = await ctx.request.fetch(rewritten, {
        method: route.request().method(),
        headers,
        data: route.request().postDataBuffer() || undefined,
      });
      const body = await response.body();
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body,
      });
    } catch {
      await route.abort();
    }
  });
}

async function loadPage(browser, path) {
  const ctx = await browser.newContext();
  await installLocalhostRewrite(ctx);
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const mainStatuses = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()} -- ${r.failure()?.errorText}`));
  page.on('response', (resp) => {
    const url = resp.url();
    if (url === `${BASE}${path}` || url === `${BASE}${path}/`) {
      mainStatuses.push(resp.status());
    }
  });

  const resp = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for data fetch + rendering
  await page.waitForTimeout(3500);

  const bodyText = await page.evaluate(() => document.body.innerText || '');
  const hasErrorBoundary = bodyText.includes('Application error') || bodyText.includes('client-side exception');
  const is404 = bodyText.includes('404') && bodyText.includes('This page could not be found');

  await ctx.close();
  return {
    status: resp ? resp.status() : 0,
    mainStatuses,
    bodyText,
    consoleErrors,
    pageErrors,
    failedRequests,
    hasErrorBoundary,
    is404,
  };
}

async function login(browser, email, password) {
  const ctx = await browser.newContext();
  await installLocalhostRewrite(ctx);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.fill('input[placeholder*="邮箱"], input[type="email"], #email', email);
  await page.fill('input[type="password"], #password', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  const tokens = await page.evaluate(() => ({
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }));
  await ctx.close();
  return tokens;
}

async function loadPageWithAuth(browser, path, accessToken, refreshToken) {
  const ctx = await browser.newContext();
  await installLocalhostRewrite(ctx);
  // Inject tokens before the page script runs
  await ctx.addInitScript(
    (tokens) => {
      window.localStorage.setItem('access_token', tokens.access);
      if (tokens.refresh) window.localStorage.setItem('refresh_token', tokens.refresh);
      window.localStorage.setItem('auth-storage', JSON.stringify({
        state: { token: tokens.access, refreshToken: tokens.refresh || '', isAuthenticated: true },
        version: 0,
      }));
    },
    { access: accessToken, refresh: refreshToken },
  );
  const page = await ctx.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  const hasErrorBoundary = bodyText.includes('Application error') || bodyText.includes('client-side exception');
  const is404 = bodyText.includes('404') && bodyText.includes('This page could not be found');
  await ctx.close();
  return { bodyText, hasErrorBoundary, is404, consoleErrors, pageErrors };
}

(async () => {
  const browser = await chromium.launch();
  async function pause() { await new Promise((r) => setTimeout(r, 1500)); }

  // ---- Public pages ----
  const publicPages = [
    { path: '/', needsProduct: true },
    { path: '/products', needsProduct: true },
    { path: '/products/2', needsProduct: true },
    { path: '/products/3', needsProduct: true },
    { path: '/products/search?q=Pro', needsProduct: true },
    { path: '/categories', needsProduct: false },
    { path: '/cart', needsProduct: false },
    { path: '/login', needsProduct: false },
    { path: '/register', needsProduct: false },
    { path: '/forgot-password', needsProduct: false },
    { path: '/about', needsProduct: false },
    { path: '/contact', needsProduct: false },
    { path: '/privacy', needsProduct: false },
    { path: '/help/shipping', needsProduct: false },
    { path: '/help/returns', needsProduct: false },
    { path: '/orders/track', needsProduct: false },
    { path: '/admin', needsProduct: false },
    { path: '/checkout', needsProduct: false },
    { path: '/checkout/success', needsProduct: false },
  ];

  for (const { path, needsProduct } of publicPages) {
    const r = await loadPage(browser, path);
    check(`${path} loads (not 404 / not crashed)`, !r.is404 && !r.hasErrorBoundary,
      `is404=${r.is404} boundary=${r.hasErrorBoundary} pageErrors=${r.pageErrors.slice(0,1).join('|')}`);
    if (needsProduct) {
      const hasProduct = r.bodyText.includes('演示手机') || r.bodyText.includes('演示笔记本');
      check(`${path} displays seeded product data`, hasProduct,
        `sample=${r.bodyText.replace(/\s+/g,' ').slice(0,250)}`);
    }
    await pause();
  }

  // ---- Admin flow with real login ----
  const tokens = await login(browser, 'admin@demo.local', 'Admin@1234');
  check('admin login via UI captures access_token', !!tokens.access && tokens.access.length > 40,
    `tokenLen=${tokens.access?.length || 0}`);

  if (tokens.access) {
    const adminPages = [
      '/admin',
      '/admin/products',
      '/admin/orders',
      '/admin/users',
      '/admin/payments',
      '/admin/content',
      '/admin/analytics',
    ];
    for (const path of adminPages) {
      const r = await loadPageWithAuth(browser, path, tokens.access, tokens.refresh);
      check(`${path} loads (admin)`, !r.is404 && !r.hasErrorBoundary,
        `is404=${r.is404} boundary=${r.hasErrorBoundary} pageErrors=${r.pageErrors.slice(0,1).join('|')}`);
      await pause();
    }
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== BROWSER RESULT: passed=${results.length - failed.length} failed=${failed.length} ===`);
  if (failed.length > 0) {
    console.log('\nFAILURES:');
    failed.forEach((f) => console.log(`  - ${f.name}\n    ${f.detail}`));
  }
  process.exit(failed.length > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
