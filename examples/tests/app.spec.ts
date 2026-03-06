import { test, expect } from '@playwright/test';
import { goToApp } from './helpers';

test.describe('App shell', () => {
  test('loads and shows the heading', async ({ page }) => {
    await goToApp(page);
    await expect(page.getByTestId('app-heading')).toHaveText('yielderact examples');
    await page.screenshot({ path: 'test-results/app-loaded.png' });
  });

  test('shows all five tabs', async ({ page }) => {
    await goToApp(page);
    await expect(page.getByTestId('tab-counter')).toBeVisible();
    await expect(page.getByTestId('tab-todos')).toBeVisible();
    await expect(page.getByTestId('tab-theme')).toBeVisible();
    await expect(page.getByTestId('tab-data')).toBeVisible();
    await expect(page.getByTestId('tab-hooks')).toBeVisible();
  });
});
