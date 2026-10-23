import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5174', deviceScaleFactor: 2 },
  webServer: { command: 'npx vite --mode sahte --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, timeout: 60_000 },
  // CI'da bir kez yeniden dener; yeniden denenip geçen test raporda "flaky" görünür, sessizce yeşil sayılmaz
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
});
