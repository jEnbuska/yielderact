import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  use: {
    headless: true,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
