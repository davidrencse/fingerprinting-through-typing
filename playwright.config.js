import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:5174', browserName: 'chromium', viewport: { width: 1280, height: 900 }, screenshot: 'only-on-failure' },
  webServer: { command: 'node server.js', env: { PORT: '5174' }, url: 'http://127.0.0.1:5174', reuseExistingServer: false },
  workers: 2,
  projects: [
    { name: 'chromium', use: {browserName:'chromium'} },
    { name: 'firefox', use: {browserName:'firefox'} },
    { name: 'webkit', use: {browserName:'webkit'} },
  ],
});
