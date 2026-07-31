const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const outputDir = process.argv[2];
if (!outputDir) throw new Error('Usage: node scripts/capture-storefront-baseline.cjs <output-dir>');

const versions = [
  { name: 'head-baseline', baseURL: 'http://localhost:3000' },
  { name: 'current', baseURL: 'http://localhost:8080' },
];
const viewports = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 1000 },
];
const screenshotPaths = [
  ['home', '/en'],
  ['products', '/en/products'],
  ['product-40', '/en/products/40'],
  ['cart', '/en/cart'],
  ['checkout', '/en/checkout'],
];
const metricPaths = [
  ['home', '/en'],
  ['products', '/en/products'],
];

fs.mkdirSync(outputDir, { recursive: true });

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__storefrontLab = { cls: 0, lcp: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__storefrontLab.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__storefrontLab.lcp = last.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}
  });
}

async function seedCart(page, baseURL) {
  try {
    await page.goto(`${baseURL}/en/products/40`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const radios = page.getByRole('radio');
    if (await radios.count()) await radios.first().click();
    const addButton = page.getByRole('button', { name: /Add to cart/i }).first();
    if (await addButton.count() && await addButton.isEnabled()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const dialog = page.getByRole('dialog');
      if (await dialog.count() && await dialog.isVisible()) {
        const continueButton = dialog.getByRole('button', { name: /Continue shopping/i });
        if (await continueButton.count()) await continueButton.click();
      }
    }
    return true;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function captureScreenshots(browser, version) {
  const results = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const cartSeed = await seedCart(page, version.baseURL);
    for (const [name, route] of screenshotPaths) {
      await page.goto(`${version.baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      const file = path.join(outputDir, `${version.name}-${viewport.name}-${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.push({ viewport: viewport.name, route, file, cartSeed });
    }
    await context.close();
  }
  return results;
}

async function measureRoute(browser, version, viewport, name, route) {
  const runs = [];
  for (let run = 1; run <= 3; run += 1) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await installObservers(page);
    await page.goto(`${version.baseURL}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const byType = (type) => resources
        .filter((entry) => entry.initiatorType === type)
        .reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
      return {
        ttfb: navigation ? navigation.responseStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd : 0,
        load: navigation ? navigation.loadEventEnd : 0,
        lcp: window.__storefrontLab?.lcp || 0,
        cls: window.__storefrontLab?.cls || 0,
        transferBytes: resources.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0),
        jsBytes: byType('script'),
        cssBytes: byType('css'),
        imageBytes: byType('img'),
        resourceCount: resources.length,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    runs.push({ run, ...metrics });
    await context.close();
  }
  return { viewport: viewport.name, name, route, runs };
}

function summarize(measurement) {
  const keys = ['ttfb', 'domContentLoaded', 'load', 'lcp', 'cls', 'transferBytes', 'jsBytes', 'cssBytes', 'imageBytes', 'resourceCount'];
  const average = {};
  for (const key of keys) {
    average[key] = measurement.runs.reduce((sum, run) => sum + run[key], 0) / measurement.runs.length;
  }
  average.horizontalOverflow = measurement.runs.some((run) => run.horizontalOverflow);
  return { ...measurement, average };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const report = { capturedAt: new Date().toISOString(), versions: {} };
  for (const version of versions) {
    const screenshots = await captureScreenshots(browser, version);
    const measurements = [];
    for (const viewport of viewports) {
      for (const [name, route] of metricPaths) {
        measurements.push(summarize(await measureRoute(browser, version, viewport, name, route)));
      }
    }
    report.versions[version.name] = { baseURL: version.baseURL, screenshots, measurements };
  }
  await browser.close();
  fs.writeFileSync(path.join(outputDir, 'metrics.json'), JSON.stringify(report, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
