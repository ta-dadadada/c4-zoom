import { defineConfig, devices } from '@playwright/test';

const site = 'http://127.0.0.1:43791/c4-zoom/';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: site,
  },
  webServer: {
    command:
      'pnpm build && pnpm preview --host 127.0.0.1 --port 43791 --strictPort --base /c4-zoom/',
    url: site,
    timeout: 120_000,
  },
});
