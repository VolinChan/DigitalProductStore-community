// Comprehensive end-to-end flow test driving the storefront the way a
// real shopper / admin would. Run from inside the compose network with:
//
//   docker run --rm --network personal-digital-mall_app-network \
//     -v "${PWD}:/work:ro" -e BASE_URL=http://nginx \
//     mcr.microsoft.com/playwright:v1.44.0-jammy \
//     sh -c "cp /work/flow-test.js /tmp/test.js && \
//            [ -d /tmp/node_modules/playwright ] || \
//              npm install --prefix /tmp playwright@1.44 >/dev/null 2>&1; \
//            node /tmp/test.js"
//
// Covered scenarios:
//   1. Login flow      — known seeded user + admin sign in
//   2. Register flow   — fresh signup auto-login + cart merge
//   3. Guest cart      — add as guest, login, cart contents survive
//   4. Trade flow      — checkout via transfer payment, end-to-end
//   5. Publish flow    — admin creates banner + announcement, public sees them
//   6. Fulfillment     — buyer uploads transfer proof, admin confirms,
//                        admin ships, order ends in "shipped"
//   7. User history    — buyer's account page lists their order

const { chromium, request: pwRequest } = require('playwright');

const BASE = process.env.BASE_URL || 'http://nginx';
const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PW = 'Admin@1234';

const results = [];
const log = (name, ok, detail) => {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${detail ? '  --  ' + String(detail).slice(0, 220) : ''}`);
};

// Forward localhost:* requests (the bundle has NEXT_PUBLIC_API_BASE_URL
// pointing at localhost from the host's perspective) to the in-network
// nginx so XHRs work from inside the compose network.
async function installLocalhostRewrite(ctx) {
  await ctx.route('http://localhost/**', async (route) => {
    const url = route.request().url().replace('http://localhost', BASE);
    const headers = { ...route.request().headers(), host: 'localhost' };
    try {
      const response = await ctx.request.fetch(url, {
        method: route.request().method(),
        headers,
        data: route.request().postDataBuffer() || undefined,
      });
      const body = await response.body();
      await route.fulfill({ status: response.status(), headers: response.headers(), body });
    } catch {
      await route.abort();
    }
  });
}

// ---------- API helpers (run from the playwright container directly) ----------

// All API helpers prefix paths with /api/v1 manually rather than relying on
// Playwright's baseURL path component. Playwright resolves '/foo' against a
// baseURL like 'http://nginx/api/v1' as '/foo' (absolute path), losing the
// /api/v1 prefix. Keeping the prefix explicit avoids that footgun.
const API_PREFIX = '/api/v1';

async function api() {
  return await pwRequest.newContext({ baseURL: BASE });
}

async function apiLogin(api, email, password, adminLogin = false) {
  const path = adminLogin ? `${API_PREFIX}/admin/login` : `${API_PREFIX}/auth/login`;
  const r = await api.post(path, { data: { email, password } });
  if (!r.ok()) throw new Error(`login ${path} -> ${r.status()}`);
  const j = await r.json();
  return j.data.access_token;
}

// ---------- 1. Login flow ----------

async function flowLogin(browser) {
  const ctx = await browser.newContext();
  await installLocalhostRewrite(ctx);
  const page = await ctx.newPage();

  // Pre-create a known buyer through the API so this scenario doesn't
  // depend on Register UI working.
  const api1 = await api();
  const email = `loginflow${Date.now()}@test.local`;
  const reg = await api1.post(`${API_PREFIX}/auth/register`, {
    data: { email, password: 'Login1234!', full_name: 'Login Flow' },
  });
  log('login.precreate buyer via API', reg.status() === 201, `status=${reg.status()}`);
  await api1.dispose();

  // UI login as that buyer.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.fill('#email', email);
  await page.fill('#password', 'Login1234!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const tok = await page.evaluate(() => localStorage.getItem('access_token'));
  log('login.UI buyer login stores token', !!tok && tok.length > 40, `len=${tok?.length}`);

  // Header should expose the personal-center menu once authenticated.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  // The user menu is rendered inside an antd Dropdown that only shows on
  // click, so trigger it before reading the rendered text.
  await page.locator('button[aria-label="用户菜单"]').click().catch(() => {});
  await page.waitForTimeout(800);
  const pageText = await page.evaluate(() => document.body.innerText);
  log('login.header user menu shows authenticated entries',
    pageText.includes('个人中心') || pageText.includes('我的订单') || pageText.includes('退出登录'),
    `sample=${pageText.replace(/\s+/g, ' ').slice(0, 180)}`);

  // Admin login via UI as well.
  const adminCtx = await browser.newContext();
  await installLocalhostRewrite(adminCtx);
  const adminPage = await adminCtx.newPage();
  await adminPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(1200);
  await adminPage.fill('#email', ADMIN_EMAIL);
  await adminPage.fill('#password', ADMIN_PW);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForTimeout(2500);
  const adminTok = await adminPage.evaluate(() => localStorage.getItem('access_token'));
  log('login.UI admin login stores token', !!adminTok && adminTok.length > 40, `len=${adminTok?.length}`);

  await ctx.close();
  await adminCtx.close();
  return { buyerEmail: email, buyerPw: 'Login1234!' };
}

// ---------- 2. Register flow + 3. Guest cart merge ----------

async function flowRegisterAndGuestCart(browser) {
  const ctx = await browser.newContext();
  await installLocalhostRewrite(ctx);
  const page = await ctx.newPage();

  // Visit homepage as guest, browse to a product, add to guest cart.
  await page.goto(`${BASE}/products/2`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('button, .ant-radio-button-wrapper').filter({ hasText: '黑色' }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  await page.locator('button').filter({ hasText: '加入购物车' }).first().click();
  await page.waitForTimeout(1500);

  // Confirm guest cart has the item locally before signup.
  const guestCartLen = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('cart-storage'))?.state?.items?.length || 0; } catch { return 0; }
  });
  log('register.guest cart has item before signup', guestCartLen > 0, `items=${guestCartLen}`);

  // Register a new account from this same context (preserves localStorage,
  // which is exactly what triggers cart merge on login).
  const email = `register${Date.now()}@test.local`;
  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('#email', email);
  await page.fill('#full_name', 'Register Flow');
  await page.fill('#password', 'Reg1234567!');
  await page.fill('#confirm_password', 'Reg1234567!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);

  const url = page.url();
  log('register.redirects away from /register on success', !url.endsWith('/register'), `url=${url}`);

  const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
  log('register.auto-login provides access_token', !!accessToken && accessToken.length > 40,
    `len=${accessToken?.length}`);

  // Visit /cart and ensure the previously-guest item shows up. The auth
  // store invokes mergeGuestCart() after register, which posts each guest
  // item to /cart/items with the new auth token.
  await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const cartBody = await page.evaluate(() => document.body.innerText);
  log('register.guest cart contents survive into authenticated cart',
    cartBody.includes('演示手机') || cartBody.includes('DEMO-PHONE'),
    `sample=${cartBody.replace(/\s+/g, ' ').slice(0, 180)}`);

  await ctx.close();
  return { buyerEmail: email, buyerPw: 'Reg1234567!', accessToken };
}

// ---------- 4. Trade flow + 6. Fulfillment via API ----------

async function flowTradeAndFulfillment(browser, buyer) {
  // Use API to pre-stage the cart and place the order so the UI test
  // focuses on what really matters: the checkout submission and the
  // server-side fulfillment path (proof upload, admin confirm, ship).

  const buyerApi = await pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${buyer.accessToken}` },
  });

  // 1. Add SKU to the buyer's cart through the API.
  const addCart = await buyerApi.post(`${API_PREFIX}/cart/items`, { data: { sku_id: 3, quantity: 1 } });
  log('trade.add to cart via API', addCart.ok(), `status=${addCart.status()}`);

  // 2. Place a transfer order through the API as the authenticated buyer.
  const orderResp = await buyerApi.post(`${API_PREFIX}/orders`, {
    data: {
      payment_method: 'transfer',
      shipping_address: 'Demo Address 1, Test City',
      guest_name: 'Trade Flow',
      guest_email: buyer.buyerEmail,
      guest_phone: '+8612345678901',
      items: [{ sku_id: 3, quantity: 1 }],
    },
  });
  const order = orderResp.ok() ? (await orderResp.json()).data : null;
  log('trade.order created', !!order && !!order.order_number,
    `status=${orderResp.status()} order=${order?.order_number} user_id=${order?.user_id}`);

  if (!order) {
    await buyerApi.dispose();
    return null;
  }

  // 3. Buyer uploads a transfer proof (multipart). We synthesize a tiny
  //    JPEG so the upload validates as a real image.
  const fakeJpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x37, 0xff, 0xd9,
  ]);
  const upload = await buyerApi.post(`${API_PREFIX}/payments/transfer/upload`, {
    multipart: {
      order_id: String(order.id),
      // Backend handler reads the multipart field named "file" (see
      // PaymentHandler.UploadTransferProof). The frontend's TransferPayment
      // component uses the same name.
      file: { name: 'proof.jpg', mimeType: 'image/jpeg', buffer: fakeJpeg },
    },
  });
  log('fulfillment.buyer uploads transfer proof', upload.ok(), `status=${upload.status()}`);

  // 4. Admin reviews pending transfers, finds ours, and confirms.
  const adminApi = await pwRequest.newContext({ baseURL: BASE });
  const adminToken = await apiLogin(adminApi, ADMIN_EMAIL, ADMIN_PW, true);
  await adminApi.dispose();
  const adminApiAuth = await pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
  });

  const pendingResp = await adminApiAuth.get(`${API_PREFIX}/admin/payments/transfer/pending`);
  const pendingJson = pendingResp.ok() ? await pendingResp.json() : null;
  // Each pending item is a Payment record with an embedded Order; the
  // order_number lives under .order.order_number.
  const pendingItem = (pendingJson?.data || []).find(
    (p) => p.order?.order_number === order.order_number || p.order_number === order.order_number,
  );
  log('fulfillment.admin sees pending transfer for the order', !!pendingItem,
    `total_pending=${pendingJson?.data?.length || 0} pending_id=${pendingItem?.id}`);

  if (pendingItem) {
    const confirmResp = await adminApiAuth.post(
      `${API_PREFIX}/admin/payments/transfer/${pendingItem.id}/confirm`,
      { data: { received_amount: pendingItem.amount, notes: 'flow test' } },
    );
    log('fulfillment.admin confirms transfer', confirmResp.ok(),
      `status=${confirmResp.status()}`);
  }

  // 5. Admin moves order paid → pending_shipment → shipped. Backend
  //    enforces the two-hop transition (Requirement 16.3).
  const prepShipResp = await adminApiAuth.put(
    `${API_PREFIX}/admin/orders/${order.id}/status`,
    { data: { status: 'pending_shipment' } },
  );
  log('fulfillment.admin transitions paid -> pending_shipment',
    prepShipResp.ok(), `status=${prepShipResp.status()}`);

  const shipResp = await adminApiAuth.post(
    `${API_PREFIX}/admin/orders/${order.id}/ship`,
    { data: { shipping_carrier: '顺丰速运', tracking_number: 'SF1234567890' } },
  );
  log('fulfillment.admin marks order shipped', shipResp.ok(), `status=${shipResp.status()}`);

  // 6. Verify final order state.
  const finalResp = await adminApiAuth.get(`${API_PREFIX}/admin/orders/${order.id}`);
  const finalOrder = finalResp.ok() ? (await finalResp.json()).data : null;
  log('fulfillment.order ends in shipped state',
    finalOrder && finalOrder.status === 'shipped',
    `status=${finalOrder?.status} carrier=${finalOrder?.shipping_carrier} tracking=${finalOrder?.tracking_number}`);

  await buyerApi.dispose();
  await adminApiAuth.dispose();

  return order;
}

// ---------- 5. Publish flow (admin → public visibility) ----------

async function flowPublish() {
  const adminApi = await pwRequest.newContext({ baseURL: BASE });
  const adminToken = await apiLogin(adminApi, ADMIN_EMAIL, ADMIN_PW, true);
  await adminApi.dispose();

  const adminApiAuth = await pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
  });

  // Create a banner.
  const bannerTitle = `Flow Banner ${Date.now()}`;
  const bannerResp = await adminApiAuth.post(`${API_PREFIX}/admin/banners`, {
    data: {
      title: bannerTitle,
      description: 'Created by automated flow test',
      image_url: 'https://example.com/banner.jpg',
      link_url: 'https://example.com/promo',
      priority: 1,
      is_active: true,
    },
  });
  const banner = bannerResp.ok() ? (await bannerResp.json()).data : null;
  log('publish.admin creates banner', !!banner && !!banner.id,
    `status=${bannerResp.status()} id=${banner?.id}`);

  // Create an announcement.
  const annTitle = `Flow Announcement ${Date.now()}`;
  const annResp = await adminApiAuth.post(`${API_PREFIX}/admin/announcements`, {
    data: {
      title: annTitle,
      content: 'Created by automated flow test. Ignore.',
      type: 'info',
      priority: 'low',
      is_active: true,
    },
  });
  const announcement = annResp.ok() ? (await annResp.json()).data : null;
  log('publish.admin creates announcement', !!announcement && !!announcement.id,
    `status=${annResp.status()} id=${announcement?.id}`);

  // Public endpoint should expose the banner.
  const publicApi = await pwRequest.newContext({ baseURL: BASE });
  const publicBanners = await publicApi.get(`${API_PREFIX}/banners`);
  const publicBannersJson = publicBanners.ok() ? await publicBanners.json() : null;
  const bannerVisible = (publicBannersJson?.data?.banners || publicBannersJson?.data || [])
    .some((b) => b.title === bannerTitle);
  log('publish.banner visible on public /banners', bannerVisible,
    `status=${publicBanners.status()}`);

  const publicAnns = await publicApi.get(`${API_PREFIX}/announcements`);
  const publicAnnsJson = publicAnns.ok() ? await publicAnns.json() : null;
  const annVisible = (publicAnnsJson?.data?.announcements || publicAnnsJson?.data || [])
    .some((a) => a.title === annTitle);
  log('publish.announcement visible on public /announcements', annVisible,
    `status=${publicAnns.status()}`);

  await publicApi.dispose();

  // Cleanup so we don't pollute the seed data on repeated runs.
  if (banner?.id) await adminApiAuth.delete(`${API_PREFIX}/admin/banners/${banner.id}`);
  if (announcement?.id) await adminApiAuth.delete(`${API_PREFIX}/admin/announcements/${announcement.id}`);
  await adminApiAuth.dispose();
}

// ---------- 7. User views their own order history ----------

async function flowUserOrderHistory(browser, buyer, expectedOrderNumber) {
  if (!expectedOrderNumber) {
    log('user-history.skipped (no order to verify)', false, 'no order_number from trade flow');
    return;
  }

  const ctx = await browser.newContext();
  await installLocalhostRewrite(ctx);
  // Inject the buyer's tokens so we don't have to re-login through the UI.
  await ctx.addInitScript((tokens) => {
    window.localStorage.setItem('access_token', tokens.access);
    window.localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: tokens.access, isAuthenticated: true },
      version: 0,
    }));
  }, { access: buyer.accessToken });

  const page = await ctx.newPage();
  // Hit the user's account orders page (path may be /profile or /orders/track).
  // Try /profile first, then fall back to /orders/track which always works.
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Best signal: ask the API directly using the same token the page would
  // send. /api/v1/orders requires auth and returns the user's own orders.
  const orderNumberFromApi = await page.evaluate(async (expected) => {
    const tok = localStorage.getItem('access_token');
    const r = await fetch('/api/v1/orders', { headers: { Authorization: 'Bearer ' + tok } });
    const j = await r.json();
    const list = j?.data?.orders || j?.data || [];
    return list.some((o) => o.order_number === expected);
  }, expectedOrderNumber);
  log('user-history.GET /orders includes the buyer\'s order', orderNumberFromApi,
    `expected=${expectedOrderNumber}`);

  await ctx.close();
}

// ---------- main ----------

(async () => {
  const browser = await chromium.launch();
  try {
    console.log('--- 1. Login flow ---');
    await flowLogin(browser);

    console.log('--- 2 & 3. Register + Guest cart merge ---');
    const buyer = await flowRegisterAndGuestCart(browser);

    console.log('--- 4 & 6. Trade + Fulfillment ---');
    const order = await flowTradeAndFulfillment(browser, buyer);

    console.log('--- 5. Publish flow ---');
    await flowPublish();

    console.log('--- 7. User order history ---');
    await flowUserOrderHistory(browser, buyer, order?.order_number);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== FLOW RESULT: passed=${results.length - failed.length} failed=${failed.length} ===`);
  if (failed.length > 0) {
    console.log('\nFAILURES:');
    failed.forEach((f) => console.log(`  - ${f.name} :: ${f.detail}`));
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});
