import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'seo-foundation.spec.ts',
  fullyParallel: false,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:3111', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/seo-fixture-api.mjs',
      url: 'http://127.0.0.1:4010/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'npm run build && HOSTNAME=127.0.0.1 PORT=3111 node .next/standalone/server.js',
      url: 'http://127.0.0.1:3111/robots.txt',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        INTERNAL_API_BASE_URL: 'http://127.0.0.1:4010',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4010',
        SITE_URL: 'https://www.plexoria.cl',
        SEO_INDEXING_ENABLED: 'true',
        SEO_REVALIDATE_SECONDS: '60',
        SEO_REVALIDATION_SECRET: 'seo-test-revalidation-secret',
      },
    },
  ],
});
