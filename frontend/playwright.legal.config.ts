import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'legal-trust.spec.ts',
  fullyParallel: false,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:3130', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-web-security'] } } }],
  webServer: {
    command: 'npm run build && HOSTNAME=127.0.0.1 PORT=3130 node .next/standalone/server.js',
    url: 'http://127.0.0.1:3130/es-CL/legal',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      SEO_E2E_CLIENT_CATALOG: 'true',
      NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED: 'false',
      NEXT_PUBLIC_TRANSFER_BANK_NAME: 'Banco de Prueba',
      NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME: 'Plexoria SpA',
      NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER: '123456789',
    },
  },
});
