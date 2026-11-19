import { defineConfig, devices } from '@playwright/test';

const nestedBasePath = '/test-game/build/';
// On Windows, render headless Chromium through the GPU (Direct3D 11) instead
// of software; it halves the suite's wall time. Elsewhere Chromium's defaults.
const gpuArgs =
  process.platform === 'win32'
    ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu']
    : [];

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  workers: 1,
  // In software rendering headless Chromium draws the canvas at roughly 12 fps,
  // below the game's 15 fps floor, so walking runs in slow motion. Waits allow
  // for that where the GPU flags below do not apply.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:4173${nestedBasePath}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
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
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: gpuArgs },
      },
    },
  ],
});
