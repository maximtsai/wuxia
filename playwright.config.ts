import { defineConfig, devices } from '@playwright/test';

const nestedBasePath = '/test-game/build/';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:4173${nestedBasePath}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command:
      'npm run preview -- --host 127.0.0.1 --port 4173 --base /test-game/build/',
    url: `http://127.0.0.1:4173${nestedBasePath}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
