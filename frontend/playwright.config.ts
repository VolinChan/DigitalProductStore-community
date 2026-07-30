import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/admin/categories',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_TRANSFER_BANK_NAME: 'Banco de Prueba',
      NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME: 'PLEXORIA Test',
      NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER: '123456789',
    },
  },
});
