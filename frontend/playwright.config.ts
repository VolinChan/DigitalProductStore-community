import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3110',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-web-security'] } } },
  ],
  webServer: {
    command: 'npm run build && HOSTNAME=127.0.0.1 PORT=3110 node .next/standalone/server.js',
    url: 'http://127.0.0.1:3110/admin/categories',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      SEO_E2E_CLIENT_CATALOG: 'true',
      NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED: 'true',
      NEXT_PUBLIC_TRANSFER_BANK_NAME: 'Banco de Prueba',
      NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME: 'PLEXORIA Test',
      NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER: '123456789',
    },
  },
});
